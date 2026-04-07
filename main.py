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
