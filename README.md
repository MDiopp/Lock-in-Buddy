![banner](lockin_frontend/src/assets/banner.png)

<h1 align="center">Lock-In Buddy</h1>

<p align="center">A productivity-focused robot buddy paired with a desktop app designed to help users stay locked in!</p>

---

## ✨ Features

- **Real-time focus detection** — uses your webcam to track head pose every frame and detect when you look away or down
- **Phone detection** — optionally flags when a cell phone appears in the camera frame
- **Strike system** — accumulates up to 3 strikes per session; BMO reacts with escalating reactions and the 3rd strike fires the water trigger
- **Water trigger hardware** — optional Arduino-based serial integration that physically sprays water when the user hits 3 distractions in a session
- **Pomodoro-style timer** — configurable session lengths for Lock In (default 25 min), Short Break (5 min), and Long Break (15 min)
- **Achievement system** — unlock different achievements throughout your lock-in sessions that have varying difficulties
- **Calibration** — capture your natural seated head position so detection is tuned to you, not a generic default
- **Persistent settings** — timer durations are saved locally and restored on next launch
- **Desktop notifications** — notifies you when a session ends even if the window is in the background
- **Mode themes** — the UI color scheme changes per mode (Lock In, Short Break, Long Break)
- **WebSocket state streaming** — backend pushes focus state updates in real time over a WebSocket connection
- **Live transcription** — microphone audio is streamed to a local Whisper model and transcribed in real time during a session
- **AI note generation** — convert a session transcript into structured study notes (bullet points, summary, or Cornell format) via a local Ollama LLM; no API keys or internet required

---

## 🗂️ Architecture

```
lockin_frontend/          React + TypeScript + Tauri desktop shell
  src/
    components/           UI screens (WelcomeScreen, MainPage, RunningScreen,
                           Calibration, SettingsScreen, ...)
    hooks/
      useTimer.ts         Countdown logic with session-end notification
      useDetectionSession.ts  WebSocket client — streams focus state from backend,
                               drives the strike system
      useTranscription.ts WebSocket client — streams raw PCM audio to backend,
                           receives live transcript updates
      notifications.ts    Tauri notification bridge
    modes/
      themeByMode.ts      Per-mode colors + default timer lengths
      types.ts            Shared TypeScript types

main.py                   FastAPI app — HTTP + WebSocket API layer

lockin_ai/                AI-powered transcription and note generation
  transcriptionService.py Manages Whisper model + per-session audio chunks;
                           sessions of any length stay flat in memory via VAD
  noteGenerationService.py Sends final transcript to Ollama; returns structured notes
  schemas.py              Pydantic models for sessions, transcripts, and notes

lockin_backend/           Python detection package
  camera.py               CameraManager — owns cv2.VideoCapture + FaceLandmarker,
                           opened once at startup so both modes share it instantly
  faceService.py          Lock-in detection loop (head pose + phone detection)
                           → emits raw DetectionState per frame
  faceCalibration.py      Calibration-only loop — lightweight preview + pose capture,
                           no state machine or callbacks
  stateMachine.py         Debounce layer — requires N seconds of distraction before
                           escalating to ALERT; enforces cooldown between alerts
  waterTrigger.py         Optional serial-port hardware integration — sends PRESS\n
                           to an Arduino/MCU to fire a water spray on the 3rd strike
  schemas.py              Shared Pydantic models (DetectionState, CalibrationData, ...)
  models/                 MediaPipe .task model files
```

**Data flow (Lock In session):**

```
Webcam
  │
  ▼
CameraManager.read_frame() + detect_landmarks()   (shared, always open)
  │
  ▼
FaceService._classify()     head pose + phone check → raw DetectionState / frame
  │
  ▼
StateMachine.feed()         debounce → stable state (LOCKED_IN / DISTRACTED / ALERT)
  │  WebSocket broadcast
  ▼
useDetectionSession (React hook)   increments strike count on ALERT
  │
  ▼
MainPage / RunningScreen    BMO reacts (mad1 → mad2 → mad3)
  │
  ▼  (3rd strike, server-side)
WaterTrigger.press()        sends "PRESS\n" over serial → Arduino → water spray
                             (fires once per session; no-op if hardware is disabled)
```

**Note taker flow:**

```
User opens Note Taker in the app
  → POST /transcription/start  (creates a session)
  → useTranscription hook opens WS /transcription/{id}/stream
  → Microphone PCM audio chunks sent over WebSocket every ~3-5 s
  → faster-whisper transcribes each chunk independently (VAD filters silence)
  → {chunk, full_transcript} pushed back to the UI in real time
  → User clicks Stop → POST /transcription/{id}/stop
  → User clicks Generate Notes → POST /notes/generate
  → NoteGenerationService sends transcript to local Ollama (llama3.2)
  → Structured notes returned in chosen style (bullet / summary / cornell)
```

**Calibration flow:**

```
User opens Calibration screen
  → FaceService stops (releases frame loop)
  → FaceCalibration starts (lightweight loop, same shared camera)
  → MJPEG preview streams to the UI
  → User clicks "Lock In!" → pose captured + saved to calibration.json
  → FaceCalibration stops → next session uses the saved pose
```

---

## 🛠️ Tech Stack

**Frontend**
- React + TypeScript
- Tauri
- Tailwind CSS

**Backend**
- Python + FastAPI
- MediaPipe (face landmark detection)
- OpenCV (computer vision library)
- WebSockets (real-time state streaming)
- pyserial (optional — serial communication with Arduino water-trigger hardware)

**AI / ML**
- faster-whisper (local speech-to-text)
- Ollama (local LLM inference for note generation: default model- `llama3.2`)

---

## 📦 Installation

### Prerequisites
For Tauri: https://tauri.app/start/prerequisites/

For React: Node.js https://nodejs.org/en/download

For Python backend: Python 3.11+ and pip

For AI features: [Ollama](https://ollama.com) installed and the model pulled:
```bash
ollama pull llama3.2
```
The Whisper model (`base.en`, ~150 MB) downloads automatically on first backend startup.

### Setup

```bash
# Clone the repo
git clone https://github.com/your-username/lockin-buddy.git

# Install Python dependencies (from project root)
pip install -r requirements.txt

# Install frontend dependencies
cd lockin_frontend
npm install
cd ..
```

---

### Running — Windows

Use the provided batch scripts from the **project root**:

| Script | What it does |
|---|---|
| `.\start.bat` | Starts the backend + Tauri frontend (normal use) |
| `.\start.debug.bat` | Starts the backend only in debug mode (OpenCV preview window + session auto-started) |

Or run manually in two terminals:

```powershell
# Terminal 1 — backend
python -m uvicorn main:app --reload

# Terminal 2 — frontend
cd lockin_frontend
npm run tauri dev
```

---

### Running — Mac

Use the provided shell scripts from the **project root**. Make them executable once after cloning:

```bash
chmod +x start.sh start.debug.sh
```

| Script | What it does |
|---|---|
| `./start.sh` | Starts the backend in a new Terminal window, then launches the Tauri frontend |
| `./start.debug.sh` | Starts the backend only in debug mode (OpenCV preview window + session auto-started). Press Enter to stop. |

> **Note:** The scripts use macOS's built-in Terminal.app to open the backend in a separate window. If you use iTerm2 or another terminal emulator the backend window may not open automatically, but the server will still start — you can open the debug preview at `http://localhost:8000/debug/preview`.

Or run manually in two terminals:

```bash
# Terminal 1 — backend (from project root)
python3 -m uvicorn main:app --reload

# Terminal 2 — frontend
cd lockin_frontend
npm run tauri dev
```

---

## ⚠️ Disclaimer

This project was created for **KnightHacks Project Launch 2026** solely for education purposes.

This project includes a design inspired by BMO from Adventure Time.

BMO is a character owned by Cartoon Network.
This project is for educational and non-commercial purposes only.
No copyright infringement is intended.
This project is not affiliated with or endorsed by Cartoon Network.

