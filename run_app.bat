@echo off
title Portal Jadwal TPB 2026/2027
echo ===================================================
echo     PORTAL JADWAL TPB ITERA GASAL 2026/2027
echo ===================================================
echo.
echo [1/2] Menyiapkan server FastAPI...
start "" http://localhost:8000
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
pause
