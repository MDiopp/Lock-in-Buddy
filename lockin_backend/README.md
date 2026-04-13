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
```

---

## Files

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
         → Tauri frontend receives event → triggers BMO alert sequence

t=3.5s User looks back up
         → FaceService emits LOCKED_IN
         → StateMachine resets distraction timer, state = LOCKED_IN
         → 3s cooldown still active (next alert won't fire until t=6s)
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
| `GET` | `/debug/preview` | HTML page with live MJPEG camera preview |
| `GET` | `/debug/preview/stream` | Raw MJPEG stream (shows calibration preview when calibrating) |
