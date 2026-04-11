import cv2
import mediapipe as mp
import numpy as np
import threading
import time
import urllib.request
from pathlib import Path
from typing import Callable, Optional

from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    FaceLandmarker,
    FaceLandmarkerOptions,
    ObjectDetector,
    ObjectDetectorOptions,
    RunningMode,
)

from .schemas import DetectionState

# ── Model paths ────────────────────────────────────────────────────────────────
_MODELS_DIR = Path(__file__).resolve().parent / "models"
_FACE_MODEL_PATH = _MODELS_DIR / "face_landmarker.task"
_PHONE_MODEL_PATH = _MODELS_DIR / "efficientdet_lite0.task"

_FACE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
)

COCO_CELL_PHONE_CLASS = "cell phone"


def _ensure_face_model() -> Path:
    """Download the face-landmarker model if it doesn't exist yet."""
    if _FACE_MODEL_PATH.exists():
        return _FACE_MODEL_PATH
    _MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[FaceService] Downloading face_landmarker.task …")
    urllib.request.urlretrieve(_FACE_MODEL_URL, _FACE_MODEL_PATH)
    print(f"[FaceService] Saved to {_FACE_MODEL_PATH}")
    return _FACE_MODEL_PATH


# Landmark indices for simple gaze direction
# Left eye outer corner, right eye outer corner, nose tip
_LEFT_EYE = 33
_RIGHT_EYE = 263
_NOSE_TIP = 1
_FOREHEAD = 10
_CHIN = 152

# ── Head-pose helpers ──────────────────────────────────────────────────────────

def _get_face_direction(landmarks) -> tuple[float, float]:
    """Return (yaw_ratio, pitch_ratio) using simple landmark positions.

    yaw_ratio:   0.5 = looking straight, <0.5 = looking left, >0.5 = looking right
    pitch_ratio: ~0.5 = looking straight, higher = looking down, lower = looking up
    """
    nose = landmarks[_NOSE_TIP]
    left_eye = landmarks[_LEFT_EYE]
    right_eye = landmarks[_RIGHT_EYE]
    forehead = landmarks[_FOREHEAD]
    chin = landmarks[_CHIN]

    # Yaw: where is the nose horizontally between the two eyes?
    eye_dx = right_eye.x - left_eye.x
    if abs(eye_dx) < 1e-6:
        yaw_ratio = 0.5
    else:
        yaw_ratio = (nose.x - left_eye.x) / eye_dx

    # Pitch: where is the nose vertically between forehead and chin?
    face_dy = chin.y - forehead.y
    if abs(face_dy) < 1e-6:
        pitch_ratio = 0.5
    else:
        pitch_ratio = (nose.y - forehead.y) / face_dy

    return yaw_ratio, pitch_ratio


# ── Phone detection (optional) ─────────────────────────────────────────────────

def _try_load_phone_detector():
    """Return an ObjectDetector instance if the model file exists, else None."""
    if not _PHONE_MODEL_PATH.exists():
        return None
    try:
        base_opts = BaseOptions(model_asset_path=str(_PHONE_MODEL_PATH))
        opts = ObjectDetectorOptions(
            base_options=base_opts,
            score_threshold=0.4,
            max_results=5,
        )
        return ObjectDetector.create_from_options(opts)
    except Exception as e:
        print(f"[FaceService] Phone detector unavailable: {e}")
        return None


def _phone_in_frame(detector, frame_rgb: np.ndarray) -> bool:
    """Return True if a cell phone is detected in the frame."""
    if detector is None:
        return False
    try:
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        result = detector.detect(mp_image)
        for detection in result.detections:
            for category in detection.categories:
                if category.category_name == COCO_CELL_PHONE_CLASS:
                    return True
    except Exception:
        pass
    return False


# ── FaceService ────────────────────────────────────────────────────────────────

class FaceService:
    """Runs the camera + detection loop in a background thread.

    Call `start()` to begin and `stop()` to end.
    Subscribe via `on_state_change` to receive `DetectionState` updates.
    """

    # How far the yaw_ratio can deviate from 0.5 (center) before distracted
    YAW_TOLERANCE = 0.15
    # Calibrated pitch range where the user is considered locked in (straight-facing)
    PITCH_MIN = 0.49
    PITCH_MAX = 0.62

    def __init__(self, camera_index: int = 0, debug: bool = False, cv2_preview: bool = False):
        self._camera_index = camera_index
        self._debug = debug
        self._cv2_preview = cv2_preview
        self._preview_lock = threading.Lock()
        self._preview_jpeg: Optional[bytes] = None
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._state = DetectionState.UNKNOWN
        self._state_lock = threading.Lock()
        self._on_state_change: Optional[Callable[[DetectionState], None]] = None
        self._on_raw_sample: Optional[Callable[[DetectionState], None]] = None
        self._phone_detector = _try_load_phone_detector()

    @property
    def state(self) -> DetectionState:
        with self._state_lock:
            return self._state

    def on_state_change(self, callback: Callable[[DetectionState], None]):
        """Register a callback invoked whenever the detection state changes."""
        self._on_state_change = callback

    def on_raw_sample(self, callback: Callable[[DetectionState], None]):
        """Register a callback invoked for every processed raw detection sample."""
        self._on_raw_sample = callback

    @property
    def debug(self) -> bool:
        return self._debug

    def get_preview_jpeg(self) -> Optional[bytes]:
        """Latest debug frame as JPEG, for MJPEG streaming (safe from any thread)."""
        with self._preview_lock:
            return self._preview_jpeg

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3.0)
        self._set_state(DetectionState.UNKNOWN)
        with self._preview_lock:
            self._preview_jpeg = None

    # ── Internal ──────────────────────────────────────────────────────────────

    def _set_state(self, new_state: DetectionState):
        with self._state_lock:
            if self._state == new_state:
                return
            self._state = new_state
        if self._on_state_change:
            self._on_state_change(new_state)

    def _classify(self, landmarks, frame_shape, frame_rgb: np.ndarray) -> DetectionState:
        """Check if user is looking at the screen using landmark ratios."""
        yaw_ratio, pitch_ratio = _get_face_direction(landmarks)
        self._last_yaw_ratio = yaw_ratio
        self._last_pitch_ratio = pitch_ratio

        yaw_off = abs(yaw_ratio - 0.5) > self.YAW_TOLERANCE
        pitch_off = not (self.PITCH_MIN <= pitch_ratio <= self.PITCH_MAX)
        phone_present = _phone_in_frame(self._phone_detector, frame_rgb)

        if yaw_off or pitch_off or phone_present:
            return DetectionState.DISTRACTED
        return DetectionState.LOCKED_IN

    def _run(self):
        cap = cv2.VideoCapture(self._camera_index)
        if not cap.isOpened():
            print(f"[FaceService] Could not open camera {self._camera_index}")
            self._set_state(DetectionState.UNKNOWN)
            return

        model_path = _ensure_face_model()
        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(model_path)),
            running_mode=RunningMode.IMAGE,
            num_faces=1,
            min_face_detection_confidence=0.6,
            min_face_presence_confidence=0.6,
            min_tracking_confidence=0.6,
        )

        with FaceLandmarker.create_from_options(options) as landmarker:
            while not self._stop_event.is_set():
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.05)
                    continue

                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
                results = landmarker.detect(mp_image)

                if not results.face_landmarks:
                    raw_state = DetectionState.AWAY
                else:
                    landmarks = results.face_landmarks[0]
                    raw_state = self._classify(landmarks, frame.shape, frame_rgb)

                if self._on_raw_sample:
                    self._on_raw_sample(raw_state)
                self._set_state(raw_state)

                if self._debug:
                    debug_frame = frame.copy()
                    if results.face_landmarks:
                        h, w = debug_frame.shape[:2]
                        for lm in results.face_landmarks[0]:
                            cx, cy = int(lm.x * w), int(lm.y * h)
                            cv2.circle(debug_frame, (cx, cy), 1, (0, 255, 0), -1)
                    yr = getattr(self, '_last_yaw_ratio', 0.5)
                    pr = getattr(self, '_last_pitch_ratio', 0.5)
                    cv2.putText(
                        debug_frame,
                        f"State: {self.state.value}",
                        (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        1,
                        (0, 255, 0),
                        2,
                    )
                    cv2.putText(
                        debug_frame,
                        f"Yaw: {yr:.2f}  Pitch: {pr:.2f}",
                        (10, 70),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8,
                        (255, 255, 0),
                        2,
                    )
                    ok, buf = cv2.imencode(
                        ".jpg", debug_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 82]
                    )
                    if ok:
                        with self._preview_lock:
                            self._preview_jpeg = buf.tobytes()

                    if self._cv2_preview:
                        cv2.imshow("LockIn — Debug Preview", debug_frame)
                        cv2.waitKey(1)

        if self._cv2_preview:
            cv2.destroyAllWindows()
        cap.release()


if __name__ == "__main__":
    import time as _time

    print(
        "Starting FaceService in debug mode. "
        "For a live preview, run the API (uvicorn main:app) and open "
        "http://127.0.0.1:8000/debug/preview"
    )
    svc = FaceService(camera_index=0, debug=True)
    svc.on_state_change(lambda s: print(f"State → {s.value}"))
    svc.start()
    try:
        while svc._thread and svc._thread.is_alive():
            _time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        svc.stop()
        print("Stopped.")
