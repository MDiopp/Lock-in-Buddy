# lockin_frontend

The face of Lock-in Buddy. This package handles everything the user sees and interacts with — from the welcome screen and mode selection all the way to the animated BMO alert and calibration flow.

Built with **React 19 + TypeScript**, bundled by **Vite**, wrapped in **Tauri 2** for a native desktop shell, and styled with **Tailwind CSS v4**.

---

## Architecture Overview

```
App.tsx                  ← root; owns theme, audio, and top-level screen routing
  │
  ├── WelcomeScreen      ← landing page; requests notification permission
  │
  ├── SettingsScreen     ← calibration management (reset / recalibrate)
  │     └── Calibration  ← live MJPEG preview + pose-capture flow
  │
  └── MainPage           ← main hub; orchestrates modes, timer, and detection
        ├── ModeSelector ← lock in / short break / long break tabs
        ├── TimerPanel   ← countdown display + session-length input
        └── RunningScreen← active session view with BMO face + trigger overlays
              │
              └── useDetectionSession (hook)
                    ├── WebSocket → backend /ws
                    └── strike counter → fires TriggerEvent callbacks
```

---

## Screens

### Welcome → Main flow

1. **WelcomeScreen** — shown on first load. "Continue" requests notification permission and enters the main page. "Settings" opens the calibration screen.
2. **MainPage** — the primary UI. User picks a mode, sets a duration, and presses **Start**.
3. **RunningScreen** — fullscreen active-session view. BMO's face animates based on the current trigger state.

### Settings flow

- **SettingsScreen** — shows two buttons: **Reset to Default** (calls `POST /calibration/reset`) and **Change Calibration** (opens the `Calibration` component).
- **Calibration** — starts the backend calibration camera (`POST /calibration/start`), streams the MJPEG preview, and captures the user's head pose (`POST /calibration/capture`) when they click "Lock In!".

---

## Files

### `App.tsx`
Root component. Owns:
- **Screen routing** — `showWelcome` / `showSettings` flags control which screen renders
- **Theme** — reads `themeByMode[activeMode]` and injects CSS variables (`--customGreen`, `--lighterGreen`, `--classicWhite`) onto the root `<div>`
- **Audio engine** — creates a single `AudioContext`, pre-loads all sound buffers via `fetch` + `decodeAudioData`, and exposes a `playSound(key)` helper; sounds are played on a `pointerdown` capture listener and via event callbacks from child components

---

### `components/WelcomeScreen.tsx`
Landing screen with the app title, tagline, and two buttons (Continue / Settings). Calls `requestNotificationPermission()` when the user clicks Continue.

---

### `components/MainPage.tsx`
Orchestrates the idle and active states of a session:
- Holds `modeDurations` (per-mode session length, persisted to `localStorage` under the key `lockin-buddy-mode-durations`)
- Uses `useTimer` and `useDetectionSession` hooks
- Manages `activeTrigger` (`TriggerEvent | null`) and the `resumeAfterTrigger` / `endSessionAfterTrigger` flags so the timer pauses during an alert overlay and resumes correctly after
- Dispatches `onTriggerInitiated`, `onBreakSessionStart`, `onBreakSessionEnd` callbacks up to `App.tsx` for audio

---

### `components/RunningScreen.tsx`
Fullscreen view shown while a session is active. Renders:
- **BMO's face** — SVG swapped by mode (`lockIn`, `shortBreak`, `longBreak`) and trigger (`success`, `mad1`, `mad2`, `mad3`)
- **Timer display** — formatted `MM:SS`
- **Trigger overlays** — tinted panels with escalating titles ("hey focus…" → "lock in…" → "LOCK IN!!!")
- **Confetti** — CSS animation on the `success` trigger (session complete)
- **Skip button** — ends the session early

---

### `components/ModeSelector.tsx`
Three `TypeButton` tabs: **lock in**, **short break**, **long break**. Highlights the active mode.

---

### `components/TimerPanel.tsx`
Idle-state panel showing the countdown and a number input for adjusting the session length. Also triggers `requestNotificationPermission()` when the start button is pressed.

---

### `components/TypeButton.tsx`
Shared button component for mode tabs. Exports the `ButtonMode` type (`"lockIn" | "shortBreak" | "longBreak"`).

---

### `components/SettingsScreen.tsx`
Renders the calibration management panel. Calls `POST /calibration/reset` directly and delegates to the `Calibration` component for the live capture flow.

---

### `components/Calibration.tsx`
Calibration wizard:
1. On mount → `POST /calibration/start`; on unmount → `POST /calibration/stop`
2. Shows the live MJPEG stream from `GET /debug/preview/stream` alongside step-by-step instructions
3. "Lock In!" button → `POST /calibration/capture` → saves the captured pose; calls `onDone()`

---

### `hooks/useDetectionSession.ts`
Manages the WebSocket connection to the backend and the strike system.

- Opens a WebSocket to `/ws`, then calls `POST /session/start` once the connection is open (so no ALERT broadcasts are missed)
- On `ALERT` state: increments strike counter (max 3), fires `onStrike(count)` — maps to `mad1` / `mad2` / `mad3` trigger events
- On `LOCKED_IN` state: fires `onLockedIn()`, resets `alertConsumed` flag
- On disable (session ends): resets strike counter; does NOT call `POST /session/stop` — that is handled by `MainPage` directly
- All callbacks are stored in refs to avoid stale closure issues

---

### `hooks/useTimer.ts`
Countdown timer hook:
- `timerLengthMinutes` → `totalSeconds`; resets whenever the length changes
- Runs a `setInterval` at 1 Hz while `isRunning && secondsLeft > 0`
- Fires a "Time for a break!" notification exactly once when the timer crosses `1 → 0`
- Exposes `{ minutes, seconds, secondsLeft, isRunning, isFinished, start, pause, toggle, reset }`

---

### `hooks/notifications.ts`
Adapter that dispatches notifications through the correct API depending on the runtime:
- **Tauri** — uses `@tauri-apps/plugin-notification` (`requestPermission` / `notify` via IPC)
- **Browser** — uses the Web Notifications API

---

### `modes/themeByMode.ts`
Single source of truth for per-mode configuration:

| Mode | Duration | Theme colours |
|---|---|---|
| `lockIn` | 25 min | Green (`#4BBBA2` / `#B6FFC7`) |
| `shortBreak` | 5 min | Teal (`#4BAABB` / `#B6FFF0`) |
| `longBreak` | 15 min | Blue (`#4B70BB` / `#B6CEFF`) |

Each mode also defines `triggerDurationMs` — how long each trigger overlay is shown (break modes set all to `0` since detection is disabled during breaks).

---

### `modes/types.ts`
Exports the `TriggerEvent` union type: `"success" | "mad1" | "mad2" | "mad3"`.

---

## Strike System

When the backend sends an `ALERT` state over WebSocket, `useDetectionSession` increments a strike counter and fires `onStrike(count)` which maps to a trigger event:

| Strike | Trigger | Tone |
|---|---|---|
| 1 | `mad1` | Gentle nudge — "hey focus…" |
| 2 | `mad2` | Firmer — "lock in…" |
| 3 | `mad3` | Urgent — "LOCK IN!!!" |

After 3 strikes the counter stops incrementing. When the user looks back at the screen (`LOCKED_IN`), the `alertConsumed` flag resets so the next distraction can trigger again.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_LOCKIN_API_URL` | `http://localhost:8000` | Base URL for all backend HTTP and WebSocket calls |

---

## Running the Frontend

From the **project root** (`Lock-in-Buddy/`):

```powershell
.\start.bat
```

This starts both the FastAPI backend and the Tauri dev build together.

### Or run separately

Install dependencies (first time only):
```powershell
cd lockin_frontend
npm install
```

Start the Tauri dev window:
```powershell
npm run tauri dev
```

Build for production:
```powershell
npm run tauri build
```

---

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
