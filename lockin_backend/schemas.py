from enum import Enum
from pydantic import BaseModel


class DetectionState(str, Enum):
    LOCKED_IN = "LOCKED_IN"
    DISTRACTED = "DISTRACTED"
    ALERT = "ALERT"
    AWAY = "AWAY"
    UNKNOWN = "UNKNOWN"


class StatusPayload(BaseModel):
    state: DetectionState
    message: str = ""


class SessionResponse(BaseModel):
    running: bool
    message: str


class CalibrationData(BaseModel):
    yaw_center: float
    pitch_center: float


class WaterTriggerActionResponse(BaseModel):
    ok: bool
    enabled: bool
    connected: bool
    error: str | None = None


class WaterTriggerStatusResponse(BaseModel):
    enabled: bool
    connected: bool
    port: str
    error: str | None = None
