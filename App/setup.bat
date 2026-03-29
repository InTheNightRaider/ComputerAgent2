@echo off
echo ======================================
echo  Universe AI — First-time Setup
echo ======================================
echo.

:: ── Frontend ──────────────────────────────────────────────────────────────────
echo [1/4] Installing root tooling (concurrently)...
cd "%~dp0"
call npm install
if %ERRORLEVEL% neq 0 ( echo ERROR: root npm install failed & pause & exit /b 1 )

echo.
echo [2/4] Installing frontend dependencies...
cd "%~dp0frontend"
call npm install
if %ERRORLEVEL% neq 0 ( echo ERROR: frontend npm install failed & pause & exit /b 1 )

:: ── Python sidecar — local .venv ──────────────────────────────────────────────
echo.
echo [3/4] Creating Python virtual environment in sidecar\.venv ...
cd "%~dp0sidecar"

:: Create the venv if it doesn't already exist
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo ERROR: python -m venv failed.
        echo Make sure Python 3.9+ is installed and in your PATH.
        pause
        exit /b 1
    )
)

echo.
echo [4/4] Installing sidecar dependencies into .venv ...
.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
.venv\Scripts\python.exe -m pip install -r requirements.txt
if %ERRORLEVEL% neq 0 ( echo ERROR: pip install failed & pause & exit /b 1 )

echo.
echo ======================================
echo  Setup complete!
echo ======================================
echo.
echo Sidecar Python: %~dp0sidecar\.venv\Scripts\python.exe
echo.
echo To start development mode, run:
echo   dev.bat
echo.
pause
