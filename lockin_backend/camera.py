import cv2
import mediapipe as mp
import threading
import urllib.request
from pathlib import Path
from typing import Optional

from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    FaceLandmarker,
    FaceLandmarkerOptions,
    RunningMode,
)

# ── Model paths ────────────────────────────────────────────────────────────────
_MODELS_DIR = Path(__file__).resolve().parent / "models"
_FACE_MODEL_PATH = _MODELS_DIR / "face_landmarker.task"
_FACE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "face_landmarker/face_landmarker/float16/latest/face_landmarker.task"
)


def _ensure_face_model() -> Path:
    """Download the face-landmarker model if it doesn't exist yet."""
    if _FACE_MODEL_PATH.exists():
        return _FACE_MODEL_PATH
    _MODELS_DIR.mkdir(parents=True, exist_ok=True)
    print("[CameraManager] Downloading face_landmarker.task …")
    urllib.request.urlretrieve(_FACE_MODEL_URL, _FACE_MODEL_PATH)
    print(f"[CameraManager] Saved to {_FACE_MODEL_PATH}")
    return _FACE_MODEL_PATH


class CameraManager:
    """Owns the single cv2.VideoCapture and FaceLandmarker instance.

    Open once at app startup so neither calibration nor lock-in sessions
    pay the ~6-7 s camera + model initialisation cost more than once.
    """

    def __init__(self, camera_index: int = 0):
        self._camera_index = camera_index
        self._lock = threading.Lock()
        self._cap: Optional[cv2.VideoCapture] = None
        self._landmarker: Optional[FaceLandmarker] = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def open(self):
        """Open the camera and load the face-landmarker model (slow, do once)."""
        with self._lock:
            if self._cap is not None and self._cap.isOpened():
                return
            print(f"[CameraManager] Opening camera {self._camera_index} …")
            self._cap = cv2.VideoCapture(self._camera_index)
            if not self._cap.isOpened():
                self._cap = None
                raise RuntimeError(
                    f"Could not open camera {self._camera_index}"
                )
            print("[CameraManager] Camera opened.")

            model_path = _ensure_face_model()
            options = FaceLandmarkerOptions(
                base_options=BaseOptions(model_asset_path=str(model_path)),
                running_mode=RunningMode.IMAGE,
                num_faces=1,
                min_face_detection_confidence=0.6,
                min_face_presence_confidence=0.6,
                min_tracking_confidence=0.6,
            )
            self._landmarker = FaceLandmarker.create_from_options(options)
            print("[CameraManager] FaceLandmarker ready.")

    def close(self):
        """Release camera and landmarker (call on app shutdown)."""
        with self._lock:
            if self._landmarker is not None:
                self._landmarker.close()
                self._landmarker = None
            if self._cap is not None:
                self._cap.release()
                self._cap = None
            print("[CameraManager] Closed.")

    @property
    def is_open(self) -> bool:
        with self._lock:
            return self._cap is not None and self._cap.isOpened()

    # ── Frame / detection ─────────────────────────────────────────────────────

    def read_frame(self):
        """Return (ret, frame_bgr) just like cv2.VideoCapture.read().

        Thread-safe — multiple consumers can call this, but only one will
        read at a time (the lock serialises access to the capture device).
        """
        with self._lock:
            if self._cap is None:
                return False, None
            return self._cap.read()

    def detect_landmarks(self, frame_rgb):
        """Run face-landmarker on an RGB frame and return the result."""
        with self._lock:
            if self._landmarker is None:
                return None
        # Detection itself is thread-safe once created; no need to hold lock.
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
        return self._landmarker.detect(mp_image)
