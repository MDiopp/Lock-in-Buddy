#!/bin/bash
set -e

# ── Start FastAPI backend (debug mode) in a new terminal tab ──────────────────
echo "Starting FastAPI backend (debug mode)..."
osascript -e 'tell application "Terminal" to do script "cd \"'"$PWD"'\" && LOCKIN_CV2_PREVIEW=1 LOCKIN_WATER_TRIGGER_ENABLED=1 LOCKIN_WATER_TRIGGER_PORT=COM5 LOCKIN_WATER_TRIGGER_BAUD=115200 python3 -m uvicorn main:app --reload"'

# ── Wait for the server to be ready ───────────────────────────────────────────
echo "Waiting for server to be ready..."
for i in $(seq 1 15); do
  if curl -s http://localhost:8000/ > /dev/null 2>&1; then
    echo "Server is ready."
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "ERROR: Server did not start in time." >&2
    exit 1
  fi
  sleep 1
done

# ── Start detection session ────────────────────────────────────────────────────
echo "Starting detection session..."
curl -s -X POST http://localhost:8000/session/start > /dev/null

echo ""
echo "Backend running. Debug preview: http://localhost:8000/debug/preview"
echo "Press Enter to stop the session and exit."
read -r

curl -s -X POST http://localhost:8000/session/stop > /dev/null
echo "Session stopped."
