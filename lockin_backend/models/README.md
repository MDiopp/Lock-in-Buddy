# Models

This folder holds pre-trained model files used by the MediaPipe Tasks API.
They are binary bundles (weights + metadata) sourced from Google's model zoo — you do not train them yourself.

---

## Files

### `face_landmarker.task`
- **Purpose**: Detects 478 facial landmarks in a camera frame, used to calculate head pose (yaw and pitch)
- **Architecture**: MediaPipe Face Landmarker (bundled TFLite model)
- **Used by**: `faceService.py` → `FaceLandmarker`
- **Auto-downloaded**: Yes — `faceService.py` will download this automatically on first run if it is missing

### `efficientdet_lite0.task`
- **Purpose**: General object detection — used specifically to detect a cell phone in the camera frame
- **Architecture**: EfficientDet Lite 0 (TFLite), trained on the COCO dataset (80 everyday object classes, 320×320 input)
- **Relevant class**: `"cell phone"` (COCO class 67) — all other detected classes are ignored
- **Quantization**: float32
- **Size**: ~13 MB
- **Used by**: `faceService.py` → `_try_load_phone_detector()`
- **Score threshold**: 0.4 (configurable in `faceService.py`)
- **Optional**: If this file is absent, phone detection is silently skipped and the app falls back to gaze-only detection

**To obtain this file**, download the EfficientDet-Lite0 (float32) model from the MediaPipe object detector page at `https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector` and rename it to `efficientdet_lite0.task`.

---

## Backend Detection Architecture

This section explains how the full detection pipeline works end-to-end.

### Overview

```
Webcam
  └─► FaceService (background thread)
        ├─► MediaPipe FaceLandmarker  ──► head pose (yaw / pitch)  ─┐
        └─► EfficientDet ObjectDetector ──► phone present?          ─┤
                                                                      ▼
                                                            raw DetectionState
                                                                      │
                                                            StateMachine (debounce)
                                                                      │
                                                            stable DetectionState
                                                                      │
                                                       FastAPI WebSocket broadcast
                                                                      │
                                                            Frontend (React/Tauri)
```

### 1. FaceService — per-frame classification

`faceService.py` runs a background thread that reads frames from the webcam via OpenCV. Every frame goes through two independent checks:

**Head pose (gaze detection)**
MediaPipe's `FaceLandmarker` returns 478 facial landmarks in normalised (0–1) coordinates. Three key ratios are computed from a small subset of those landmarks:

- **Yaw ratio** — where the nose sits horizontally between the outer eye corners. `0.5` = looking straight. Deviation beyond `±0.15` from centre = distracted.
- **Pitch ratio** — where the nose sits vertically between the forehead and chin landmarks. The locked-in window is roughly `0.49 – 0.62`. Outside this = distracted.

**Phone detection**
EfficientDet Lite 0 scans the full frame for any of its 80 COCO object classes. Only the `"cell phone"` category is acted on. If a phone is detected with confidence ≥ 0.4 anywhere in the frame, the user is immediately classified as distracted — regardless of where they are looking.

The final per-frame state is:
| Condition | State |
|---|---|
| Face not visible | `AWAY` |
| Face visible, gaze on screen, no phone | `LOCKED_IN` |
| Face visible, gaze off screen **or** phone detected | `DISTRACTED` |

### 2. StateMachine — debounce and alerting

Raw per-frame states are noisy — a single glance shouldn't fire an alert. `stateMachine.py` wraps the raw output with two configurable timers:

- **`distraction_threshold`** (default 3 s) — the user must be continuously distracted for this long before the state escalates to `ALERT`
- **`cooldown`** (default 3 s) — minimum time between consecutive alerts to prevent alert spam

State transitions:
```
LOCKED_IN / UNKNOWN  ──(distracted frame)──►  DISTRACTED
DISTRACTED           ──(3 s elapsed)────────►  ALERT  ──(cooldown resets)──► DISTRACTED
DISTRACTED           ──(locked-in frame)─────►  LOCKED_IN  (timer resets)
```

### 3. FastAPI — HTTP + WebSocket API

`main.py` exposes a FastAPI server on `http://localhost:8000`:

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Health check |
| `/status` | GET | Current debounced state |
| `/session/start` | POST | Start webcam + detection loop |
| `/session/stop` | POST | Stop webcam + reset state |
| `/ws` | WebSocket | Real-time state stream pushed to all connected clients |

The WebSocket pushes a JSON message `{"state": "LOCKED_IN"}` whenever the debounced state changes. The frontend subscribes to this on load and updates the UI accordingly.

### 4. Debug mode

`FaceService` is initialised with `debug=True` in `main.py`. When active, OpenCV renders a live camera window (`LockIn Debug`) showing:
- Green dots for all 478 face landmarks
- Current state, yaw ratio, and pitch ratio overlaid as text
- Press `q` to close the window

---

## Why `.task` files?

The newer MediaPipe Tasks API requires model files to be provided explicitly by path at runtime. This is different from the classic `mp.solutions.*` API (used by older MediaPipe code) which bundled weights inside the pip package itself.

Any future detectors added to this project (e.g. gesture recognition, pose estimation) would also store their `.task` files here.

---

## Notes

- Do not rename `efficientdet_lite0.task` — `faceService.py` references it by that exact name
- `.task` files are large binary assets and are listed in `.gitignore` — they should not be committed to the repo directly
