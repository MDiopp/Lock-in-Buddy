from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
import asyncio
import json
import os

from lockin_backend.camera import CameraManager
from lockin_backend.faceService import FaceService
from lockin_backend.faceCalibration import FaceCalibration
from lockin_backend.stateMachine import StateMachine
from lockin_backend.schemas import DetectionState, SessionResponse, StatusPayload, CalibrationData

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


# Default is 0 (works on Windows). Mac users with OBS Virtual Camera on index 0
# should set LOCKIN_CAMERA_INDEX=1 to use the built-in webcam, e.g.:
#   LOCKIN_CAMERA_INDEX=1 python3 -m uvicorn main:app --reload
_camera_index = _camera_index_from_env()
_cv2_preview = os.environ.get("LOCKIN_CV2_PREVIEW", "0") == "1"

# Shared camera manager — opened once at startup, never released until shutdown
camera_manager = CameraManager(camera_index=_camera_index)

face_service = FaceService(camera_manager=camera_manager, debug=True, cv2_preview=_cv2_preview)
calibration_service = FaceCalibration(camera_manager=camera_manager)

print(
    f"[LockIn] Using camera index {_camera_index} "
    "(set env LOCKIN_CAMERA_INDEX to override; Mac users with OBS may need 1)."
)

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

def _broadcast_if_changed():
    """Forward only stable debounced state transitions to WebSocket clients."""
    global _last_broadcast_state
    current_state = state_machine.state
    if current_state == _last_broadcast_state:
        return
    _last_broadcast_state = current_state
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


@app.on_event("shutdown")
async def _shutdown():
    face_service.stop()
    calibration_service.stop()
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
    face_service.start()
    return SessionResponse(running=True, message="Session started")


@app.post("/session/stop", response_model=SessionResponse)
async def stop_session():
    global _last_broadcast_state
    face_service.stop()
    state_machine.reset()
    _last_broadcast_state = state_machine.state
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
