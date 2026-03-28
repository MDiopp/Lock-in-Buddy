import time
import threading
from typing import Callable, Optional

from .schemas import DetectionState


class StateMachine:
    """Wraps raw DetectionState from FaceService with debounce logic.

    Raw per-frame states can be noisy (a single glance shouldn't trigger an
    alert).  This class requires the DISTRACTED state to persist for
    `distraction_threshold` seconds before escalating to ALERT.  After an
    ALERT fires, a `cooldown` period prevents repeated alerts.

    Usage
    -----
    sm = StateMachine(on_alert=my_callback)
    face_service.on_state_change(sm.feed)
    """

    def __init__(
        self,
        distraction_threshold: float = 3.0,
        cooldown: float = 10.0,
        on_alert: Optional[Callable[[], None]] = None,
    ):
        self._distraction_threshold = distraction_threshold
        self._cooldown = cooldown
        self._on_alert = on_alert

        self._lock = threading.Lock()
        self._current_state = DetectionState.UNKNOWN
        self._distraction_start: Optional[float] = None
        self._last_alert_time: float = 0.0
        self._alerted = False

    @property
    def state(self) -> DetectionState:
        with self._lock:
            return self._current_state

    def feed(self, raw_state: DetectionState):
        """Accept a raw state from FaceService and apply debounce logic."""
        now = time.monotonic()
        with self._lock:
            if raw_state in (DetectionState.DISTRACTED, DetectionState.AWAY):
                if self._distraction_start is None:
                    self._distraction_start = now

                elapsed = now - self._distraction_start
                cooldown_over = (now - self._last_alert_time) >= self._cooldown

                if elapsed >= self._distraction_threshold and cooldown_over and not self._alerted:
                    self._current_state = DetectionState.ALERT
                    self._last_alert_time = now
                    self._alerted = True
                    alert_cb = self._on_alert
                else:
                    if not self._alerted:
                        self._current_state = DetectionState.DISTRACTED
                    alert_cb = None
            else:
                # User is locked in or unknown — reset distraction tracking
                self._distraction_start = None
                self._alerted = False
                self._current_state = raw_state
                alert_cb = None

        # Fire callback outside the lock to avoid deadlocks
        if alert_cb:
            alert_cb()

    def reset(self):
        """Manually reset state (e.g. when a session ends)."""
        with self._lock:
            self._current_state = DetectionState.UNKNOWN
            self._distraction_start = None
            self._alerted = False
            self._last_alert_time = 0.0
