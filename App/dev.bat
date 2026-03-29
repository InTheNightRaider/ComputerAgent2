@echo off
echo ======================================
echo  Universe AI — Dev Mode
echo ======================================
echo.

:: Verify .venv exists — prompt setup if missing
if not exist "%~dp0sidecar\.venv\Scripts\python.exe" (
    echo ERROR: sidecar\.venv not found.
    echo Run setup.bat first.
    pause
    exit /b 1
)

:: VS 2019 MSVC lib path (needed for Rust/Tauri linker on this machine)
set "LIB=C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC\14.29.30133\lib\x64;%LIB%"

:: Start Python sidecar using the local .venv
echo [1/3] Starting Python sidecar on port 8765...
start "Universe AI Sidecar" cmd /k "cd /d "%~dp0sidecar" && .venv\Scripts\python.exe main.py"
timeout /t 2 /nobreak >nul

:: Start Vite frontend
echo [2/3] Starting Vite frontend on port 5173...
start "Universe AI Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 3 /nobreak >nul

:: Open browser
echo [3/3] Opening browser at http://localhost:5173
start http://localhost:5173

echo.
echo Dev mode running.
echo   Frontend: http://localhost:5173
echo   Sidecar:  http://localhost:8765/health
echo   Python:   %~dp0sidecar\.venv\Scripts\python.exe
echo.
echo To run as Tauri desktop app (after initial setup):
echo   cd src-tauri ^&^& cargo tauri dev
echo.
echo Close the sidecar and frontend windows to stop.
