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
