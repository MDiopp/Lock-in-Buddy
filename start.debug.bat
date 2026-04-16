@echo off
echo Starting FastAPI backend (debug mode)...
start "LockIn-Backend-Debug" powershell -Command "$env:LOCKIN_CV2_PREVIEW='1'; $env:LOCKIN_AI_DISABLED='1'; python -m uvicorn main:app --reload"

echo Waiting for server to be ready...
powershell -Command "$retries = 15; $ready = $false; for ($i = 0; $i -lt $retries; $i++) { try { Invoke-RestMethod -Uri 'http://localhost:8000/' -ErrorAction Stop | Out-Null; $ready = $true; break } catch { Start-Sleep -Seconds 1 } }; if (-not $ready) { Write-Error 'Server did not start in time.'; exit 1 }"

echo Starting detection session...
powershell -Command "Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/session/start'"

echo.
echo Backend running. Debug preview: http://localhost:8000/debug/preview
echo Press any key to stop the session and exit.
pause > nul

powershell -Command "Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/session/stop'"
echo Session stopped.
