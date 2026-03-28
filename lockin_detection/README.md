# lockin_detection

The brain of Lock-in Buddy. This package handles everything related to determining whether the user is focused or distracted — from raw camera frames all the way to a debounced alert state that the API layer can act on.

---

## Architecture Overview

```
Camera (OpenCV)
      │
      ▼
 faceService.py          ← runs in a background thread
  ├── FaceMesh           (MediaPipe) — 468 face landmarks → head pose (pitch/yaw)
  └── ObjectDetector     (MediaPipe Tasks) — detects "cell phone" in frame [optional]
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

### `schemas.py`
Defines the shared data models used across the package and the API.

- **`DetectionState`** — enum with 5 values:
  - `LOCKED_IN` — user is facing forward, on task
  - `DISTRACTED` — looking down or phone detected, but threshold not yet crossed
  - `ALERT` — distraction threshold crossed, BMO should intervene
  - `AWAY` — face not in frame or looking far sideways
  - `UNKNOWN` — camera not running / initial state
- **`StatusPayload`** — API response model wrapping a `DetectionState`
- **`SessionResponse`** — API response model for start/stop session endpoints

---

### `faceService.py`
Runs the camera loop and produces a raw `DetectionState` on every frame.

**Detection pipeline (per frame):**
1. Capture frame from webcam via `cv2.VideoCapture`
2. Run MediaPipe **FaceMesh** (full 468 landmarks, `refine_landmarks=True`)
3. If no face detected → emit `AWAY`
4. If face detected → run **head-pose estimation** via `cv2.solvePnP` using 6 key landmarks (nose tip, chin, eye corners, mouth corners)
   - `pitch > 20°` → looking down → `DISTRACTED`
   - `|yaw| > 35°` → looking far sideways → `AWAY`
   - Otherwise → `LOCKED_IN`
5. Additionally (if model file present) run MediaPipe **ObjectDetector** to check for a cell phone in the frame
   - Phone detected → `DISTRACTED` regardless of head pose

**Key design decisions:**
- Runs in a **daemon thread** — won't block the FastAPI event loop
- Thread-safe state reads via `threading.Lock`
- Phone detection is **opt-in** — skipped silently if `models/efficientdet_lite0.task` is absent
- `debug=True` enables an OpenCV window with landmark overlay and live state label (dev only)

---

### `stateMachine.py`
Applies debounce and escalation logic on top of the raw per-frame states from `faceService.py`.

**Why this exists:**  
Raw frame-by-frame states are noisy — a single glance down or a shadow across the camera shouldn't trigger an alert. The state machine smooths this out.

**Logic:**
- Starts a timer the moment a `DISTRACTED` or `AWAY` state is received
- If distraction persists for `distraction_threshold` seconds (default: **3s**) → escalate to `ALERT` and fire `on_alert` callback
- After an alert fires, enforce a `cooldown` period (default: **10s**) before another alert can trigger
- If the user returns to `LOCKED_IN` at any point → reset the distraction timer and `_alerted` flag
- `reset()` method clears all state (called when a session ends)

---

### `models/`
Holds pre-trained `.task` model files for MediaPipe's Tasks API. See [`models/README.md`](models/README.md) for details.

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
         → 10s cooldown still active (next alert won't fire until t=13s)
```

---

## Thresholds (tunable)

| Parameter | Default | Location |
|---|---|---|
| Distraction before ALERT | 3.0s | `StateMachine(distraction_threshold=...)` in `main.py` |
| Cooldown after ALERT | 10.0s | `StateMachine(cooldown=...)` in `main.py` |
| Looking-down pitch | 20° | `FaceService.LOOKING_DOWN_PITCH_THRESHOLD` |
| Looking-away yaw | 35° | `FaceService.LOOKING_AWAY_YAW_THRESHOLD` |
| Phone detection confidence | 0.4 | `_try_load_phone_detector()` in `faceService.py` |
