import io
import threading
import uuid
import wave
from typing import Optional

from faster_whisper import WhisperModel

from .schemas import TranscriptionState


class TranscriptionSession:
    """Holds state for a single transcription session."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.state = TranscriptionState.RECORDING
        self.audio_buffer = io.BytesIO()
        self.transcript_chunks: list[str] = []
        self._lock = threading.Lock()

    @property
    def full_transcript(self) -> str:
        with self._lock:
            return " ".join(self.transcript_chunks)

    def append_chunk(self, text: str):
        with self._lock:
            self.transcript_chunks.append(text)

    def append_audio(self, data: bytes):
        with self._lock:
            if self.state == TranscriptionState.RECORDING:
                self.audio_buffer.write(data)

    def get_and_clear_audio(self) -> bytes:
        with self._lock:
            data = self.audio_buffer.getvalue()
            self.audio_buffer = io.BytesIO()
            return data

    def pause(self):
        self.state = TranscriptionState.PAUSED

    def resume(self):
        self.state = TranscriptionState.RECORDING

    def stop(self):
        self.state = TranscriptionState.STOPPED


class TranscriptionService:
    """Manages Whisper model and transcription sessions."""

    def __init__(self, model_size: str = "base.en", device: str = "cpu", compute_type: str = "int8"):
        print(f"[LockIn AI] Loading Whisper model '{model_size}' on {device} ({compute_type})...")
        self._model = WhisperModel(model_size, device=device, compute_type=compute_type)
        print("[LockIn AI] Whisper model loaded.")
        self._sessions: dict[str, TranscriptionSession] = {}
        self._lock = threading.Lock()

    def create_session(self) -> TranscriptionSession:
        session_id = uuid.uuid4().hex[:12]
        session = TranscriptionSession(session_id)
        with self._lock:
            self._sessions[session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[TranscriptionSession]:
        with self._lock:
            return self._sessions.get(session_id)

    def remove_session(self, session_id: str):
        with self._lock:
            self._sessions.pop(session_id, None)

    def transcribe_audio(self, raw_pcm: bytes, sample_rate: int = 16000) -> str:
        """Transcribe a chunk of raw 16-bit PCM audio and return the text."""
        if len(raw_pcm) < 1600:  # too small to be useful (~0.05s)
            return ""

        # Wrap raw PCM into a WAV in-memory so faster-whisper can read it
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(sample_rate)
            wf.writeframes(raw_pcm)
        wav_buffer.seek(0)

        segments, _ = self._model.transcribe(
            wav_buffer,
            beam_size=3,
            language="en",
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
        )
        text_parts = [seg.text.strip() for seg in segments if seg.text.strip()]
        return " ".join(text_parts)

    def process_session_buffer(self, session_id: str, sample_rate: int = 16000) -> str:
        """Pull buffered audio from a session, transcribe it, append results."""
        session = self.get_session(session_id)
        if session is None or session.state != TranscriptionState.RECORDING:
            return ""

        raw_pcm = session.get_and_clear_audio()
        if not raw_pcm:
            return ""

        text = self.transcribe_audio(raw_pcm, sample_rate)
        if text:
            session.append_chunk(text)
        return text
