from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
import asyncio
import json
import os
import threading

from lockin_backend.camera import CameraManager
from lockin_backend.faceService import FaceService
from lockin_backend.faceCalibration import FaceCalibration
from lockin_backend.stateMachine import StateMachine
from lockin_backend.schemas import (
    CalibrationData,
    DetectionState,
    SessionResponse,
    StatusPayload,
    WaterTriggerActionResponse,
    WaterTriggerStatusResponse,
)
from lockin_backend.waterTrigger import WaterTrigger

from lockin_ai.transcriptionService import TranscriptionService
from lockin_ai.noteGenerationService import NoteGenerationService
from lockin_ai.schemas import (
    NoteGenerationRequest,
    NoteGenerationResponse,
    StopTranscriptionResponse,
    TranscriptionSessionResponse,
    TranscriptionState,
)

app = FastAPI(title="LockIn Buddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tauri apps use custom scheme; lock down in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ─────────────────────────────────────────────────────────────────


def _camera_index_from_env() -> int:
    raw = os.environ.get("LOCKIN_CAMERA_INDEX", "0")
    try:
        return int(raw)
    except ValueError:
        print(f"[LockIn] Invalid LOCKIN_CAMERA_INDEX={raw!r}, using 0")
        return 0


def _bool_from_env(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _int_from_env(name: str, default: int) -> int:
    raw = os.environ.get(name, str(default))
    try:
        return int(raw)
    except ValueError:
        print(f"[LockIn] Invalid {name}={raw!r}, using {default}")
        return default


# Default is 0 (works on Windows). Mac users with OBS Virtual Camera on index 0
# should set LOCKIN_CAMERA_INDEX=1 to use the built-in webcam, e.g.:
#   LOCKIN_CAMERA_INDEX=1 python3 -m uvicorn main:app --reload
_camera_index = _camera_index_from_env()
_cv2_preview = os.environ.get("LOCKIN_CV2_PREVIEW", "0") == "1"
_water_trigger_enabled = _bool_from_env("LOCKIN_WATER_TRIGGER_ENABLED", default=False)
_water_trigger_port = os.environ.get("LOCKIN_WATER_TRIGGER_PORT", "COM5")
_water_trigger_baud = _int_from_env("LOCKIN_WATER_TRIGGER_BAUD", 115200)

# Shared camera manager — opened once at startup, never released until shutdown
camera_manager = CameraManager(camera_index=_camera_index)

face_service = FaceService(camera_manager=camera_manager, debug=True, cv2_preview=_cv2_preview)
calibration_service = FaceCalibration(camera_manager=camera_manager)
water_trigger = WaterTrigger(
    port=_water_trigger_port,
    baud=_water_trigger_baud,
    enabled=_water_trigger_enabled,
)

print(
    f"[LockIn] Using camera index {_camera_index} "
    "(set env LOCKIN_CAMERA_INDEX to override; Mac users with OBS may need 1)."
)
if _water_trigger_enabled:
    print(
        f"[LockIn] Water trigger enabled on {_water_trigger_port} "
        f"at {_water_trigger_baud} baud."
    )
else:
    print("[LockIn] Water trigger disabled (set LOCKIN_WATER_TRIGGER_ENABLED=1 to enable).")

# ── AI singletons ──────────────────────────────────────────────────────────────
_ai_disabled = _bool_from_env("LOCKIN_AI_DISABLED", default=False)
_whisper_model = os.environ.get("LOCKIN_WHISPER_MODEL", "base.en")
if _ai_disabled:
    print("[LockIn AI] Disabled (LOCKIN_AI_DISABLED=1). Transcription and note generation unavailable.")
    transcription_service = None
    note_service = None
else:
    transcription_service = TranscriptionService(model_size=_whisper_model)
    note_service = NoteGenerationService()

# ── Calibration persistence ────────────────────────────────────────────────────
from pathlib import Path as _Path

_CALIBRATION_FILE = _Path(__file__).resolve().parent / "calibration.json"


def _load_calibration():
    """Load saved calibration from disk and apply to face_service."""
    if not _CALIBRATION_FILE.exists():
        return
    try:
        data = json.loads(_CALIBRATION_FILE.read_text())
        cal = CalibrationData(**data)
        face_service.set_calibration(cal.yaw_center, cal.pitch_center)
        print(f"[LockIn] Loaded calibration: yaw={cal.yaw_center:.3f}, pitch={cal.pitch_center:.3f}")
    except Exception as e:
        print(f"[LockIn] Could not load calibration.json: {e}")


_load_calibration()
state_machine = StateMachine(distraction_threshold=3.0, cooldown=3.0)

# Event loop reference (captured when the app starts)
_loop: asyncio.AbstractEventLoop | None = None

# Connected WebSocket clients
_ws_clients: list[WebSocket] = []


_last_broadcast_state = DetectionState.UNKNOWN
_strike_lock = threading.Lock()
_session_strike_count = 0
_already_fired_this_session = False


async def _broadcast(state: DetectionState):
    """Push state change to all connected WebSocket clients."""
    payload = json.dumps({"state": state.value})
    disconnected = []
    for ws in _ws_clients:
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        _ws_clients.remove(ws)


def _reset_session_alert_tracking():
    global _session_strike_count, _already_fired_this_session
    with _strike_lock:
        _session_strike_count = 0
        _already_fired_this_session = False


def _handle_stable_state_transition(state: DetectionState):
    global _session_strike_count, _already_fired_this_session
    should_press = False

    if state == DetectionState.ALERT:
        with _strike_lock:
            _session_strike_count += 1
            if _session_strike_count == 3 and not _already_fired_this_session:
                _already_fired_this_session = True
                should_press = True

    if should_press:
        result = water_trigger.press()
        if not result["ok"] and result["error"]:
            print(f"[LockIn] Water trigger press failed: {result['error']}")

def _broadcast_if_changed():
    """Forward only stable debounced state transitions to WebSocket clients."""
    global _last_broadcast_state
    current_state = state_machine.state
    if current_state == _last_broadcast_state:
        return
    _last_broadcast_state = current_state
    _handle_stable_state_transition(current_state)
    if _loop is not None:
        asyncio.run_coroutine_threadsafe(_broadcast(current_state), _loop)


def _on_raw_sample(raw_state: DetectionState):
    """Feed every raw sample into the state machine and broadcast stable changes."""
    state_machine.feed(raw_state)
    _broadcast_if_changed()


face_service.on_raw_sample(_on_raw_sample)

# ── Startup ────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def _startup():
    global _loop
    _loop = asyncio.get_running_loop()
    # Open camera + load model once (the slow ~6-7 s cost) so session/calibration
    # start instantly from here on.
    camera_manager.open()
    if _water_trigger_enabled:
        result = await asyncio.to_thread(water_trigger.connect)
        if not result["ok"] and result["error"]:
            print(f"[LockIn] Water trigger unavailable at startup: {result['error']}")


@app.on_event("shutdown")
async def _shutdown():
    face_service.stop()
    calibration_service.stop()
    await asyncio.to_thread(water_trigger.close)
    camera_manager.close()


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "LockIn Buddy API is running"}


@app.get("/debug/preview", response_class=HTMLResponse)
async def debug_preview_page():
    """Simple page that shows the MJPEG stream (works on macOS; no OpenCV GUI thread)."""
    if not face_service.debug:
        raise HTTPException(status_code=404, detail="Debug preview is disabled (set debug=True on FaceService).")
    return HTMLResponse(
        """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>LockIn — camera preview</title>
  <style>
    body { margin: 0; background: #111; min-height: 100vh; display: flex;
           flex-direction: column; align-items: center; justify-content: center; }
    img { max-width: 100%; max-height: calc(100vh - 3rem); object-fit: contain; }
    p { color: #888; font: 13px/1.4 system-ui, sans-serif; margin: 0.75rem 1rem; text-align: center; }
  </style>
</head>
<body>
  <img src="/debug/preview/stream" alt="Live camera preview"/>
  <p>Start a <strong>lock-in</strong> session in the app so the camera runs. Green dots = face landmarks; Yaw/Pitch show head pose.</p>
</body>
</html>"""
    )


@app.get("/debug/preview/stream")
async def debug_preview_stream():
    async def mjpeg():
        while True:
            # Serve calibration preview when calibration is running,
            # otherwise serve the lock-in detection preview.
            if calibration_service.running:
                jpeg = calibration_service.get_preview_jpeg()
            else:
                if not face_service.debug:
                    break
                jpeg = face_service.get_preview_jpeg()
            if jpeg:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
                )
            await asyncio.sleep(1 / 30)

    return StreamingResponse(
        mjpeg(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-cache, no-store", "X-Accel-Buffering": "no"},
    )


@app.get("/status", response_model=StatusPayload)
async def get_status():
    state = state_machine.state
    return StatusPayload(state=state)


@app.post("/session/start", response_model=SessionResponse)
async def start_session():
    global _last_broadcast_state
    state_machine.reset()
    _last_broadcast_state = state_machine.state
    _reset_session_alert_tracking()
    face_service.start()
    return SessionResponse(running=True, message="Session started")


@app.post("/session/stop", response_model=SessionResponse)
async def stop_session():
    global _last_broadcast_state
    face_service.stop()
    state_machine.reset()
    _last_broadcast_state = state_machine.state
    _reset_session_alert_tracking()
    return SessionResponse(running=False, message="Session stopped")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    _ws_clients.append(websocket)
    # Send current state immediately on connect
    await websocket.send_text(json.dumps({"state": state_machine.state.value}))
    try:
        while True:
            # Keep connection alive; client can send pings if needed
            await websocket.receive_text()
    except WebSocketDisconnect:
        if websocket in _ws_clients:
            _ws_clients.remove(websocket)


# ── Calibration routes ─────────────────────────────────────────────────────────

@app.post("/calibration/start", response_model=SessionResponse)
async def calibration_start():
    # Stop face_service if it's running so they don't both read frames
    face_service.stop()
    calibration_service.start()
    return SessionResponse(running=True, message="Calibration camera started")


@app.post("/calibration/stop", response_model=SessionResponse)
async def calibration_stop():
    calibration_service.stop()
    return SessionResponse(running=False, message="Calibration camera stopped")


@app.post("/calibration/capture", response_model=CalibrationData)
async def calibration_capture():
    # Wait up to 5 s for the first pose sample
    pose = None
    for _ in range(50):
        pose = calibration_service.get_current_pose()
        if pose is not None:
            break
        await asyncio.sleep(0.1)

    if pose is None:
        raise HTTPException(status_code=400, detail="No face detected — look at the camera and try again.")
    yaw, pitch = pose
    cal = CalibrationData(yaw_center=yaw, pitch_center=pitch)
    _CALIBRATION_FILE.write_text(cal.model_dump_json())
    face_service.set_calibration(cal.yaw_center, cal.pitch_center)
    calibration_service.stop()
    return cal


@app.post("/calibration/reset", response_model=SessionResponse)
async def calibration_reset():
    face_service.reset_calibration()
    if _CALIBRATION_FILE.exists():
        _CALIBRATION_FILE.unlink()
    return SessionResponse(running=False, message="Calibration reset to defaults")


@app.get("/water-trigger/status", response_model=WaterTriggerStatusResponse)
async def water_trigger_status():
    return WaterTriggerStatusResponse(**water_trigger.status())


@app.post("/water-trigger/test", response_model=WaterTriggerActionResponse)
async def water_trigger_test():
    if not _water_trigger_enabled:
        status = water_trigger.status()
        return WaterTriggerActionResponse(
            ok=False,
            enabled=status["enabled"],
            connected=status["connected"],
            error="Water trigger is disabled.",
        )

    result = await asyncio.to_thread(water_trigger.press)
    return WaterTriggerActionResponse(**result)


@app.post("/water-trigger/reconnect", response_model=WaterTriggerActionResponse)
async def water_trigger_reconnect():
    if not _water_trigger_enabled:
        status = water_trigger.status()
        return WaterTriggerActionResponse(
            ok=False,
            enabled=status["enabled"],
            connected=status["connected"],
            error="Water trigger is disabled.",
        )

    result = await asyncio.to_thread(water_trigger.reconnect)
    return WaterTriggerActionResponse(**result)


# ── Transcription routes ───────────────────────────────────────────────────────

@app.post("/transcription/start", response_model=TranscriptionSessionResponse)
async def transcription_start():
    if transcription_service is None:
        raise HTTPException(status_code=503, detail="AI services are disabled (LOCKIN_AI_DISABLED=1)")
    session = transcription_service.create_session()
    return TranscriptionSessionResponse(
        session_id=session.session_id,
        state=session.state,
        message="Transcription session started",
    )


@app.post("/transcription/{session_id}/pause", response_model=TranscriptionSessionResponse)
async def transcription_pause(session_id: str):
    if transcription_service is None:
        raise HTTPException(status_code=503, detail="AI services are disabled (LOCKIN_AI_DISABLED=1)")
    session = transcription_service.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    session.pause()
    return TranscriptionSessionResponse(
        session_id=session.session_id,
        state=session.state,
        message="Transcription paused",
    )


@app.post("/transcription/{session_id}/resume", response_model=TranscriptionSessionResponse)
async def transcription_resume(session_id: str):
    if transcription_service is None:
        raise HTTPException(status_code=503, detail="AI services are disabled (LOCKIN_AI_DISABLED=1)")
    session = transcription_service.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    session.resume()
    return TranscriptionSessionResponse(
        session_id=session.session_id,
        state=session.state,
        message="Transcription resumed",
    )


@app.post("/transcription/{session_id}/stop", response_model=StopTranscriptionResponse)
async def transcription_stop(session_id: str):
    if transcription_service is None:
        raise HTTPException(status_code=503, detail="AI services are disabled (LOCKIN_AI_DISABLED=1)")
    session = transcription_service.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Process any remaining buffered audio before stopping
    await asyncio.to_thread(transcription_service.process_session_buffer, session_id)
    session.stop()
    transcript = session.full_transcript
    # Keep session around so the user can still fetch the transcript or generate notes
    return StopTranscriptionResponse(
        session_id=session.session_id,
        transcript=transcript,
        message="Transcription stopped",
    )


@app.get("/transcription/{session_id}", response_model=StopTranscriptionResponse)
async def transcription_get(session_id: str):
    if transcription_service is None:
        raise HTTPException(status_code=503, detail="AI services are disabled (LOCKIN_AI_DISABLED=1)")
    session = transcription_service.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return StopTranscriptionResponse(
        session_id=session.session_id,
        transcript=session.full_transcript,
    )


@app.websocket("/transcription/{session_id}/stream")
async def transcription_stream(websocket: WebSocket, session_id: str):
    """Receive audio chunks from the client, transcribe, and push text back."""
    if transcription_service is None:
        await websocket.close(code=4003, reason="AI services disabled")
        return
    session = transcription_service.get_session(session_id)
    if session is None:
        await websocket.close(code=4004, reason="Session not found")
        return

    await websocket.accept()

    try:
        while session.state != TranscriptionState.STOPPED:
            # Receive raw PCM audio bytes from the frontend
            data = await websocket.receive_bytes()
            session.append_audio(data)

            # Transcribe the buffered audio
            new_text = await asyncio.to_thread(
                transcription_service.process_session_buffer, session_id
            )

            # Send back incremental + full transcript
            if new_text:
                await websocket.send_json({
                    "chunk": new_text,
                    "full_transcript": session.full_transcript,
                })
    except WebSocketDisconnect:
        pass


# ── Note generation routes ─────────────────────────────────────────────────────

@app.post("/notes/generate", response_model=NoteGenerationResponse)
async def notes_generate(req: NoteGenerationRequest):
    if note_service is None:
        raise HTTPException(status_code=503, detail="AI services are disabled (LOCKIN_AI_DISABLED=1)")
    if not req.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty")

    notes = await asyncio.to_thread(note_service.generate, req.transcript, req.style)
    return NoteGenerationResponse(notes=notes, style=req.style)
