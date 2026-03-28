from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json

from lockin_detection.faceService import FaceService
from lockin_detection.stateMachine import StateMachine
from lockin_detection.schemas import DetectionState, SessionResponse, StatusPayload

app = FastAPI(title="LockIn Buddy API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tauri apps use custom scheme; lock down in production
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Singletons ─────────────────────────────────────────────────────────────────
face_service = FaceService(camera_index=0, debug=True)
state_machine = StateMachine(distraction_threshold=3.0, cooldown=10.0)

# Wire detection output through the state machine
face_service.on_state_change(state_machine.feed)

# Connected WebSocket clients
_ws_clients: list[WebSocket] = []


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


def _on_alert():
    """Called by StateMachine when ALERT fires (runs in detection thread)."""
    asyncio.run_coroutine_threadsafe(
        _broadcast(DetectionState.ALERT), asyncio.get_event_loop()
    )


state_machine._on_alert = _on_alert


def _on_state_change_ws(new_state: DetectionState):
    """Forward every state change to WebSocket clients."""
    try:
        loop = asyncio.get_event_loop()
        asyncio.run_coroutine_threadsafe(_broadcast(new_state), loop)
    except RuntimeError:
        pass


# Re-register callback to also broadcast all state changes (not just alerts)
face_service.on_state_change(lambda s: (state_machine.feed(s), _on_state_change_ws(state_machine.state)))

# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "LockIn Buddy API is running"}


@app.get("/status", response_model=StatusPayload)
async def get_status():
    state = state_machine.state
    return StatusPayload(state=state)


@app.post("/session/start", response_model=SessionResponse)
async def start_session():
    face_service.start()
    state_machine.reset()
    return SessionResponse(running=True, message="Session started")


@app.post("/session/stop", response_model=SessionResponse)
async def stop_session():
    face_service.stop()
    state_machine.reset()
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
