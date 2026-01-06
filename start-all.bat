@echo off
echo ========================================
echo Starting Misdiagnose with RAG
echo ========================================
echo.

echo [1/3] Starting RAG API (port 3006)...
start "RAG API" cmd /c "cd /d D:\misdiagnose\rag_textbook && .venv\Scripts\python.exe api.py"

echo Waiting for RAG API to initialize...
timeout /t 10 /nobreak > nul

echo.
echo [2/3] Starting Express Backend (port 3005)...
start "Express Backend" cmd /c "cd /d D:\misdiagnose && npm run dev:server"

echo Waiting for backend to initialize...
timeout /t 5 /nobreak > nul

echo.
echo [3/3] Starting React Frontend (port 3000)...
start "React Frontend" cmd /c "cd /d D:\misdiagnose && npm run dev:client"

echo.
echo ========================================
echo All services starting!
echo ========================================
echo.
echo RAG API:        http://localhost:3006
echo Express API:    http://localhost:3005
echo Frontend:       http://localhost:3000
echo.
echo Press any key to exit this window...
pause > nul
