# lockin_ai

AI-powered transcription and note generation module for Lock-In Buddy. Uses your microphone to transcribe live audio, then lets you convert the transcript into structured study notes via a local Ollama LLM — no API keys, no internet required.

---

## Prerequisites

### 1. Ollama
Install Ollama from [ollama.com](https://ollama.com) and pull a model:
```
ollama pull llama3.2
```

### 2. Python packages
Already listed in `requirements.txt`. Install from the project root:
```
pip install -r requirements.txt
```

The Whisper model (`base.en`, ~150MB) downloads automatically on first backend startup.

---

## Files

| File | Purpose |
|---|---|
| `schemas.py` | Pydantic models for sessions, transcripts, and notes |
| `transcriptionService.py` | Manages Whisper model, sessions, and per-chunk audio transcription |
| `noteGenerationService.py` | Sends a final transcript to Ollama and returns structured notes |

---

## API Routes

All routes are served by the main FastAPI app (`main.py`).

### Transcription

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/transcription/start` | Create a new session. Returns `session_id`. |
| `POST` | `/transcription/{id}/pause` | Pause audio processing. |
| `POST` | `/transcription/{id}/resume` | Resume a paused session. |
| `POST` | `/transcription/{id}/stop` | Finalize the session. Returns full transcript. |
| `GET` | `/transcription/{id}` | Fetch the transcript for a session at any time. |
| `WS` | `/transcription/{id}/stream` | WebSocket — send raw PCM audio chunks, receive live transcript updates. |

#### WebSocket protocol

**Send:** raw 16-bit mono PCM audio bytes at 16 000 Hz (approximately every 3–5 seconds).

**Receive JSON:**
```json
{
  "chunk": "...newly transcribed text...",
  "full_transcript": "...entire transcript so far..."
}
```

### Note Generation

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/notes/generate` | Generate structured notes from a transcript. |

**Request body:**
```json
{
  "transcript": "...",
  "style": "bullet"
}
```

**Styles:**
- `bullet` — grouped bullet-point notes with headings (default)
- `summary` — concise paragraph summary
- `cornell` — Cornell-style with Cues, Notes, and Summary sections

**Response:**
```json
{
  "notes": "...",
  "style": "bullet"
}
```

---

## Configuration

| Env var | Default | Description |
|---|---|---|
| `LOCKIN_WHISPER_MODEL` | `base.en` | Whisper model size. Use `small.en` for better accuracy. |
| `LOCKIN_AI_MODEL` | `llama3.2` | Ollama model for note generation. |

---

## Audio chunking notes

- faster-whisper processes each chunk independently — sessions of any length (30+ minutes) stay flat in memory and latency.
- Chunks smaller than ~0.05 s are silently skipped.
- VAD (voice activity detection) is enabled, so silence between speech is automatically filtered out.
