import cv2
import threading
import time
from typing import Optional

from .camera import CameraManager

# Landmark indices
_LEFT_EYE = 33
_RIGHT_EYE = 263
_NOSE_TIP = 1
_FOREHEAD = 10
_CHIN = 152


def _get_face_direction(landmarks) -> tuple[float, float]:
    """Return (yaw_ratio, pitch_ratio) from face landmarks."""
    nose = landmarks[_NOSE_TIP]
    left_eye = landmarks[_LEFT_EYE]
    right_eye = landmarks[_RIGHT_EYE]
    forehead = landmarks[_FOREHEAD]
    chin = landmarks[_CHIN]

    eye_dx = right_eye.x - left_eye.x
    if abs(eye_dx) < 1e-6:
        yaw_ratio = 0.5
    else:
        yaw_ratio = (nose.x - left_eye.x) / eye_dx

    face_dy = chin.y - forehead.y
    if abs(face_dy) < 1e-6:
        pitch_ratio = 0.5
    else:
        pitch_ratio = (nose.y - forehead.y) / face_dy

    return yaw_ratio, pitch_ratio


class FaceCalibration:
    """Lightweight calibration-only camera loop.

    Uses the shared CameraManager so the camera + model stay alive across
    mode switches.  Produces an MJPEG preview and exposes the latest pose
    for capture.
    """

    def __init__(self, camera_manager: CameraManager):
        self._cam = camera_manager
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._preview_lock = threading.Lock()
        self._preview_jpeg: Optional[bytes] = None
        self._pose_lock = threading.Lock()
        self._last_yaw: Optional[float] = None
        self._last_pitch: Optional[float] = None

    # ── Public API ────────────────────────────────────────────────────────────

    def start(self):
        """Start the calibration preview loop."""
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._last_yaw = None
        self._last_pitch = None
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        """Stop the calibration preview loop (does NOT release the camera)."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=3.0)
            self._thread = None
        with self._preview_lock:
            self._preview_jpeg = None

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def get_preview_jpeg(self) -> Optional[bytes]:
        with self._preview_lock:
            return self._preview_jpeg

    def get_current_pose(self) -> Optional[tuple[float, float]]:
        with self._pose_lock:
            if self._last_yaw is None or self._last_pitch is None:
                return None
            return (self._last_yaw, self._last_pitch)

    # ── Internal loop ─────────────────────────────────────────────────────────

    def _run(self):
        while not self._stop_event.is_set():
            ret, frame = self._cam.read_frame()
            if not ret or frame is None:
                time.sleep(0.05)
                continue

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self._cam.detect_landmarks(frame_rgb)

            yaw, pitch = 0.5, 0.5
            face_found = False
            if results and results.face_landmarks:
                landmarks = results.face_landmarks[0]
                yaw, pitch = _get_face_direction(landmarks)
                face_found = True
                with self._pose_lock:
                    self._last_yaw = yaw
                    self._last_pitch = pitch

            # Build debug preview
            debug_frame = frame.copy()
            if results and results.face_landmarks:
                h, w = debug_frame.shape[:2]
                for lm in results.face_landmarks[0]:
                    cx, cy = int(lm.x * w), int(lm.y * h)
                    cv2.circle(debug_frame, (cx, cy), 1, (0, 255, 0), -1)

            label = "Face detected" if face_found else "No face"
            cv2.putText(
                debug_frame, label,
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2,
            )
            cv2.putText(
                debug_frame, f"Yaw: {yaw:.2f}  Pitch: {pitch:.2f}",
                (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2,
            )

            ok, buf = cv2.imencode(
                ".jpg", debug_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 82]
            )
            if ok:
                with self._preview_lock:
                    self._preview_jpeg = buf.tobytes()
