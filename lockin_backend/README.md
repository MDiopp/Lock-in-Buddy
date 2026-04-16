# lockin_backend

The brain of Lock-in Buddy. This package handles everything related to determining whether the user is focused or distracted — from raw camera frames all the way to a debounced alert state that the API layer can act on.

---

## Architecture Overview

```
camera.py (CameraManager)
  ├── cv2.VideoCapture     — opened once at app startup
  └── FaceLandmarker       (MediaPipe Tasks) — loaded once, shared by all consumers
      │
      │  raw frames + landmark results
      ├──────────────────────────────────────────┐
      ▼                                          ▼
 faceService.py                           faceCalibration.py
  ├── landmark ratio head-pose             ├── lightweight preview loop
  └── ObjectDetector (optional phone)      └── exposes current pose for capture
      │
      │  raw DetectionState per frame
      ▼
 stateMachine.py         ← debounce + escalation logic
  ├── requires N seconds of DISTRACTED before escalating to ALERT
  ├── enforces a cooldown period after each ALERT so it doesn't spam
  └── fires on_alert callback when threshold is crossed
      │
      │  stable DetectionState
      ▼
 main.py (FastAPI)       ← exposes state over HTTP + WebSocket
  ├── strike counter — tracks ALERT count per session
  └── on 3rd strike → waterTrigger.py (serial → Arduino/MCU → water spray)
      │
      │  serial PRESS command (pyserial)
      ▼
 waterTrigger.py         ← optional hardware integration
  ├── connects to a serial port (e.g. COM5 / /dev/ttyUSB0)
  ├── sends "PRESS\n" to fire the water spray mechanism
  └── thread-safe, reconnectable, gracefully disabled if not configured
```

---

## Files

| File | Purpose |
|---|---|
| `camera.py` | Owns the single `cv2.VideoCapture` and `FaceLandmarker` instance |
| `faceService.py` | Runs the detection loop; emits `DetectionState` per frame |
| `faceCalibration.py` | Lightweight calibration loop for capturing head-pose baseline |
| `stateMachine.py` | Debounce and escalation logic on top of raw frame states |
| `waterTrigger.py` | Optional serial-port hardware integration — fires a water spray mechanism |
| `schemas.py` | Shared Pydantic models for the backend and API |

---

### `camera.py`
Owns the single `cv2.VideoCapture` and `FaceLandmarker` instance for the whole application.

**Why this exists:**  
Opening a camera and loading a MediaPipe model takes ~6–7 seconds. `CameraManager` pays that cost once at app startup so session starts and calibration switches are instant.

- **`CameraManager.open()`** — opens the camera and loads `face_landmarker.task` (downloads it if missing)
- **`CameraManager.close()`** — releases the camera and landmarker (called on shutdown)
- **`CameraManager.read_frame()`** — thread-safe `(ret, frame_bgr)` read
- **`CameraManager.detect_landmarks(frame_rgb)`** — runs face landmarker on an RGB frame; thread-safe
- Camera index defaults to `0`; override with the `LOCKIN_CAMERA_INDEX` environment variable

---

### `schemas.py`
Defines the shared data models used across the package and the API.

- **`DetectionState`** — enum with 5 values:
  - `LOCKED_IN` — user is facing forward, on task
  - `DISTRACTED` — looking away or phone detected, but threshold not yet crossed
  - `ALERT` — distraction threshold crossed, BMO should intervene
  - `AWAY` — face not in frame
  - `UNKNOWN` — camera not running / initial state
- **`StatusPayload`** — API response model wrapping a `DetectionState`
- **`SessionResponse`** — API response model for start/stop session endpoints
- **`CalibrationData`** — stores `yaw_center` and `pitch_center` floats for a captured calibration pose
- **`WaterTriggerStatusResponse`** — current state of the water trigger hardware (`enabled`, `connected`, `port`, `error`)
- **`WaterTriggerActionResponse`** — result of a press/reconnect action (`ok`, `enabled`, `connected`, `error`)

---

### `faceService.py`
Runs the detection loop in a background thread using the shared `CameraManager`.

**Detection pipeline (per frame):**
1. Read a frame from `CameraManager`
2. Run `CameraManager.detect_landmarks()` (MediaPipe **FaceLandmarker**)
3. If no face detected → emit `AWAY`
4. If face detected → compute **landmark-ratio head pose** using 5 key points (nose tip, forehead, chin, eye corners)
   - `|yaw_ratio − yaw_center| > YAW_TOLERANCE (0.15)` → looking sideways → `DISTRACTED`
   - `pitch_ratio` outside `[pitch_min, pitch_max]` → looking away → `DISTRACTED`
   - Otherwise → `LOCKED_IN`
5. Additionally (if model file present) run MediaPipe **ObjectDetector** to check for a cell phone in the frame
   - Phone detected → `DISTRACTED` regardless of head pose

**Calibration support:**
- `set_calibration(yaw_center, pitch_center)` — shifts the accepted head-pose window to the user's natural resting position
- `reset_calibration()` — reverts to class defaults
- Calibration is loaded from `calibration.json` at startup if available

**Key design decisions:**
- Runs in a **daemon thread** — won't block the FastAPI event loop
- Thread-safe state reads via `threading.Lock`
- Phone detection is **opt-in** — skipped silently if `models/efficientdet_lite0.task` is absent
- `debug=True` encodes MJPEG preview frames (landmark overlay + live state label) readable via `get_preview_jpeg()`
- `on_raw_sample` callback fires on every processed frame (fed into `StateMachine`); `on_state_change` fires only when state changes

---

### `faceCalibration.py`
Lightweight calibration-only camera loop that runs instead of `FaceService` during the calibration flow.

- Uses the same shared `CameraManager` — the camera never has to restart
- Runs its own daemon thread that continuously reads frames and computes the current head pose
- `get_current_pose()` → `(yaw_ratio, pitch_ratio)` — snapshot of where the user is looking right now
- `get_preview_jpeg()` — latest MJPEG frame for the calibration preview stream
- Stopped automatically by `POST /calibration/capture` once a pose is captured

---

### `stateMachine.py`
Applies debounce and escalation logic on top of the raw per-frame states from `faceService.py`.

**Why this exists:**  
Raw frame-by-frame states are noisy — a single glance down or a shadow across the camera shouldn't trigger an alert. The state machine smooths this out.

**Logic:**
- Starts a timer the moment a `DISTRACTED` or `AWAY` state is received
- If distraction persists for `distraction_threshold` seconds (default: **3s**) → escalate to `ALERT` and fire `on_alert` callback
- After an alert fires, enforce a `cooldown` period (default: **3s**) before another alert can trigger
- If the user returns to `LOCKED_IN` or `UNKNOWN` at any point → reset the distraction timer
- `reset()` method clears all state (called when a session ends)

---

### `models/`
Holds pre-trained `.task` model files for MediaPipe's Tasks API. See [`models/README.md`](models/README.md) for details.  
`face_landmarker.task` is downloaded automatically on first run if missing.

---

### `waterTrigger.py`
Optional hardware integration that fires a physical water-spray mechanism when the user has been distracted too many times in a session.

Communicates with an Arduino or compatible microcontroller over a serial port using **pyserial**. The MCU listens for the ASCII command `PRESS\n` and activates a relay or servo to trigger the spray.

**Key methods:**
- `connect()` — open the serial port; waits `settle_seconds` (default 2s) after opening so the Arduino finishes resetting
- `reconnect()` — close and re-open the port (useful after a disconnect)
- `press()` — send `PRESS\n` over serial; returns a result dict with `ok`, `enabled`, `connected`, and `error`
- `close()` — release the serial port (called at app shutdown)
- `status()` — returns current `enabled`, `connected`, `port`, and last `error`

**Behaviour notes:**
- Completely **opt-in** — disabled by default; must set `LOCKIN_WATER_TRIGGER_ENABLED=1` to activate
- If `pyserial` is not installed, the class degrades gracefully and all operations return an error result
- Thread-safe with separate locks for serial I/O and state reads
- Duplicate error messages are **deduplicated** in logs — the same failure is only printed once
- The water trigger fires at most **once per session**: `main.py` counts ALERT strikes and only calls `press()` on the 3rd strike within a session; the flag resets when a new session starts

**Strike logic (in `main.py`):**
```
Strike 1 → frontend shows "hey focus…"   (mad1)
Strike 2 → frontend shows "lock in…"     (mad2)
Strike 3 → frontend shows "LOCK IN!!!"   (mad3)
          → water trigger fires (once per session)
```

---

## Data Flow Example

```
t=0s   User looks down at phone
         → FaceService emits DISTRACTED
         → StateMachine starts 3s timer, sets state = DISTRACTED

t=2s   User still looking down
         → FaceService keeps emitting DISTRACTED
         → StateMachine: 2s elapsed, no alert yet

t=3s   User still looking down — threshold crossed
         → StateMachine sets state = ALERT
         → on_alert() fires → main.py broadcasts {"state": "ALERT"} over WebSocket
         → Tauri frontend receives event → triggers BMO alert sequence (strike 1 → mad1)

t=3.5s User looks back up
         → FaceService emits LOCKED_IN
         → StateMachine resets distraction timer, state = LOCKED_IN
         → 3s cooldown still active (next alert won't fire until t=6s)

…      (same pattern repeats for strike 2 → mad2, strike 3 → mad3)

       On the 3rd ALERT strike in the session:
         → main.py calls water_trigger.press()
         → "PRESS\n" is sent over serial to the Arduino
         → Arduino activates the relay/servo → water spray fires
         → strike flag is set; no further sprays until the next session starts
```

---

## Thresholds (tunable)

| Parameter | Default | Location |
|---|---|---|
| Distraction before ALERT | 3.0s | `StateMachine(distraction_threshold=...)` in `main.py` |
| Cooldown after ALERT | 3.0s | `StateMachine(cooldown=...)` in `main.py` |
| Yaw tolerance (ratio) | 0.15 | `FaceService.YAW_TOLERANCE` |
| Pitch min (ratio) | 0.49 | `FaceService.PITCH_MIN` |
| Pitch max (ratio) | 0.62 | `FaceService.PITCH_MAX` |
| Phone detection confidence | 0.4 | `_try_load_phone_detector()` in `faceService.py` |
| Strikes before water trigger | 3 | `_handle_stable_state_transition()` in `main.py` |

> Yaw/pitch values are landmark ratios (0–1), not degrees. See `faceService._get_face_direction()` for the formula.

---

## Running the Backend

Open **one terminal** from the **project root** (`Lock-in-Buddy/`).

**Terminal 1 — run the start.bat file:**
```powershell
.\start.bat
```

### Or

Open **two terminals** from the **project root** (`Lock-in-Buddy/`).

**Terminal 1 — start the API server:**
```powershell
python -m uvicorn main:app --reload
```

**Terminal 2 — start a detection session:**
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/session/start"
```

To stop the session:
```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:8000/session/stop"
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LOCKIN_CAMERA_INDEX` | `0` | Which camera to open (`0` = first webcam) |
| `LOCKIN_CV2_PREVIEW` | `0` | Set to `1` to open a native OpenCV preview window |
| `LOCKIN_WATER_TRIGGER_ENABLED` | `0` | Set to `1` to enable the serial water-trigger hardware |
| `LOCKIN_WATER_TRIGGER_PORT` | `COM5` | Serial port the Arduino is connected to (e.g. `/dev/ttyUSB0` on Linux/Mac) |
| `LOCKIN_WATER_TRIGGER_BAUD` | `115200` | Baud rate for the serial connection |

---

## API Routes

| Method | Path | Description |
|---|---|---|
| `GET` | `/status` | Current debounced `DetectionState` |
| `POST` | `/session/start` | Start face detection |
| `POST` | `/session/stop` | Stop face detection |
| `WS` | `/ws` | WebSocket — pushes `{"state": "..."}` on every state change |
| `POST` | `/calibration/start` | Start calibration preview loop |
| `POST` | `/calibration/stop` | Stop calibration preview loop |
| `POST` | `/calibration/capture` | Capture current head pose and save to `calibration.json` |
| `POST` | `/calibration/reset` | Delete saved calibration and revert to defaults |
| `GET` | `/water-trigger/status` | Current hardware connection state and any error |
| `POST` | `/water-trigger/test` | Manually fire the water trigger (for testing wiring) |
| `POST` | `/water-trigger/reconnect` | Close and reopen the serial port |
| `GET` | `/debug/preview` | HTML page with live MJPEG camera preview |
| `GET` | `/debug/preview/stream` | Raw MJPEG stream (shows calibration preview when calibrating) |
