from enum import Enum
from pydantic import BaseModel


class TranscriptionState(str, Enum):
    IDLE = "IDLE"
    RECORDING = "RECORDING"
    PAUSED = "PAUSED"
    STOPPED = "STOPPED"


class TranscriptionSessionResponse(BaseModel):
    session_id: str
    state: TranscriptionState
    message: str = ""


class TranscriptUpdate(BaseModel):
    session_id: str
    chunk: str
    full_transcript: str


class StopTranscriptionResponse(BaseModel):
    session_id: str
    transcript: str
    message: str = ""


class NoteGenerationRequest(BaseModel):
    transcript: str
    style: str = "bullet"  # "bullet", "summary", "cornell"


class NoteGenerationResponse(BaseModel):
    notes: str
    style: str
