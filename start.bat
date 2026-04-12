@echo off
echo Starting FastAPI backend...
start "LockIn-Backend" powershell -Command "python -m uvicorn main:app --reload"

echo Waiting for server to be ready...
powershell -Command "$retries = 15; $ready = $false; for ($i = 0; $i -lt $retries; $i++) { try { Invoke-RestMethod -Uri 'http://localhost:8000/' -ErrorAction Stop | Out-Null; $ready = $true; break } catch { Start-Sleep -Seconds 1 } }; if (-not $ready) { Write-Error 'Server did not start in time.'; exit 1 }"

echo Starting Tauri frontend...
cd "lockin_frontend"
npm run tauri dev
