import cv2
import mediapipe as mp
import numpy as np
import threading
import time
from pathlib import Path
from typing import Callable, Optional

from .schemas import DetectionState

# ── MediaPipe setup ────────────────────────────────────────────────────────────
_mp_face_mesh = mp.solutions.face_mesh
_mp_drawing = mp.solutions.drawing_utils
_mp_drawing_styles = mp.solutions.drawing_styles

# Landmark indices used for head-pose estimation (a minimal subset)
# Nose tip, chin, left eye corner, right eye corner, left mouth, right mouth
_POSE_LANDMARKS = [1, 152, 33, 263, 61, 291]

# Path to phone-detection model (optional; detection skipped if file absent)
_MODELS_DIR = Path(__file__).parent / "models"
_PHONE_MODEL_PATH = _MODELS_DIR / "efficientdet_lite0.task"

COCO_CELL_PHONE_CLASS = "cell phone"

# ── Head-pose helpers ──────────────────────────────────────────────────────────

def _get_head_pose(landmarks, frame_shape: tuple) -> tuple[float, float]:
    """Return (pitch_deg, yaw_deg) from face mesh landmarks.

    Positive pitch  → looking down.
    Positive yaw    → looking right.
    """
    h, w = frame_shape[:2]

    image_points = np.array(
        [(landmarks[i].x * w, landmarks[i].y * h) for i in _POSE_LANDMARKS],
        dtype=np.float64,
    )

    # Generic 3D model points (mm, centred on nose tip)
    model_points = np.array(
        [
            (0.0, 0.0, 0.0),        # Nose tip
            (0.0, -63.6, -12.5),    # Chin
            (-43.3, 32.7, -26.0),   # Left eye corner
            (43.3, 32.7, -26.0),    # Right eye corner
            (-28.9, -28.9, -24.1),  # Left mouth corner
            (28.9, -28.9, -24.1),   # Right mouth corner
        ],
        dtype=np.float64,
    )

    focal_length = w
    center = (w / 2, h / 2)
    camera_matrix = np.array(
        [[focal_length, 0, center[0]], [0, focal_length, center[1]], [0, 0, 1]],
        dtype=np.float64,
    )
    dist_coeffs = np.zeros((4, 1))

    _, rotation_vec, _ = cv2.solvePnP(
        model_points, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
    )

    rotation_mat, _ = cv2.Rodrigues(rotation_vec)
    pose_mat = cv2.hconcat([rotation_mat, np.zeros((3, 1))])
    _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(pose_mat)

    pitch = float(euler_angles[0])
    yaw = float(euler_angles[1])
    return pitch, yaw


# ── Phone detection (optional) ─────────────────────────────────────────────────

def _try_load_phone_detector():
    """Return an ObjectDetector instance if the model file exists, else None."""
    if not _PHONE_MODEL_PATH.exists():
        return None
    try:
        from mediapipe.tasks import python as mp_tasks
        from mediapipe.tasks.python import vision as mp_vision

        base_opts = mp_tasks.BaseOptions(model_asset_path=str(_PHONE_MODEL_PATH))
        opts = mp_vision.ObjectDetectorOptions(
            base_options=base_opts,
            score_threshold=0.4,
            max_results=5,
        )
        return mp_vision.ObjectDetector.create_from_options(opts)
    except Exception as e:
        print(f"[FaceService] Phone detector unavailable: {e}")
        return None


def _phone_in_frame(detector, frame_rgb: np.ndarray) -> bool:
    """Return True if a cell phone is detected in the frame."""
    if detector is None:
        return False
    try:
        from mediapipe.tasks.python.vision import core as mp_core
        mp_image = mp_core.image.Image(image_format=mp_core.image.ImageFormat.SRGB, data=frame_rgb)
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

    # Pitch threshold (degrees) above which the user is considered looking down
    LOOKING_DOWN_PITCH_THRESHOLD = 20.0
    # Yaw threshold for looking far sideways (phone in peripheral)
    LOOKING_AWAY_YAW_THRESHOLD = 35.0

    def __init__(self, camera_index: int = 0, debug: bool = False):
        self._camera_index = camera_index
        self._debug = debug
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._state = DetectionState.UNKNOWN
        self._state_lock = threading.Lock()
        self._on_state_change: Optional[Callable[[DetectionState], None]] = None
        self._phone_detector = _try_load_phone_detector()

    @property
    def state(self) -> DetectionState:
        with self._state_lock:
            return self._state

    def on_state_change(self, callback: Callable[[DetectionState], None]):
        """Register a callback invoked whenever the detection state changes."""
        self._on_state_change = callback

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

    # ── Internal ──────────────────────────────────────────────────────────────

    def _set_state(self, new_state: DetectionState):
        with self._state_lock:
            if self._state == new_state:
                return
            self._state = new_state
        if self._on_state_change:
            self._on_state_change(new_state)

    def _classify(self, landmarks, frame_shape, frame_rgb: np.ndarray) -> DetectionState:
        """Combine head-pose + phone detection into a single DetectionState."""
        pitch, yaw = _get_head_pose(landmarks, frame_shape)

        looking_down = pitch > self.LOOKING_DOWN_PITCH_THRESHOLD
        looking_away = abs(yaw) > self.LOOKING_AWAY_YAW_THRESHOLD
        phone_present = _phone_in_frame(self._phone_detector, frame_rgb)

        if looking_down or phone_present:
            return DetectionState.DISTRACTED
        if looking_away:
            return DetectionState.AWAY
        return DetectionState.LOCKED_IN

    def _run(self):
        cap = cv2.VideoCapture(self._camera_index)
        if not cap.isOpened():
            print(f"[FaceService] Could not open camera {self._camera_index}")
            self._set_state(DetectionState.UNKNOWN)
            return

        with _mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.6,
            min_tracking_confidence=0.6,
        ) as face_mesh:
            while not self._stop_event.is_set():
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.05)
                    continue

                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame_rgb.flags.writeable = False
                results = face_mesh.process(frame_rgb)
                frame_rgb.flags.writeable = True

                if not results.multi_face_landmarks:
                    self._set_state(DetectionState.AWAY)
                else:
                    landmarks = results.multi_face_landmarks[0].landmark
                    raw_state = self._classify(landmarks, frame.shape, frame_rgb)
                    self._set_state(raw_state)

                if self._debug:
                    debug_frame = frame.copy()
                    if results.multi_face_landmarks:
                        for face_landmarks in results.multi_face_landmarks:
                            _mp_drawing.draw_landmarks(
                                image=debug_frame,
                                landmark_list=face_landmarks,
                                connections=_mp_face_mesh.FACEMESH_TESSELATION,
                                landmark_drawing_spec=None,
                                connection_drawing_spec=_mp_drawing_styles.get_default_face_mesh_tesselation_style(),
                            )
                    cv2.putText(
                        debug_frame,
                        f"State: {self.state.value}",
                        (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        1,
                        (0, 255, 0),
                        2,
                    )
                    cv2.imshow("LockIn Debug", debug_frame)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

        cap.release()
        if self._debug:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    import time as _time

    print("Starting FaceService in debug mode. Press 'q' in the OpenCV window to quit.")
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