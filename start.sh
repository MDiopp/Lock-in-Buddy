#!/bin/bash
set -e

# ── Start FastAPI backend in a new terminal tab ────────────────────────────────
echo "Starting FastAPI backend..."
osascript -e 'tell application "Terminal" to do script "cd \"'"$PWD"'\" && python3 -m uvicorn main:app --reload"'

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

# ── Start Tauri frontend ───────────────────────────────────────────────────────
echo "Starting Tauri frontend..."
cd "lockin_frontend"
npm run tauri dev
