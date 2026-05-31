@echo off
setlocal enabledelayedexpansion

:: ─────────────────────────────────────────────────────────────
::  start-all.bat — Launch both frontends + triage-engine backend
::
::  Usage:
::    start-all.bat                 install deps ^& start everything
::    start-all.bat --skip-install  skip npm/pip install
::
::  Close this window or Ctrl-C to stop all services.
::
::  Python packages are installed inside a venv at
::  backend\triage-engine\.venv
:: ─────────────────────────────────────────────────────────────

set "ROOT=%~dp0"
:: Remove trailing backslash
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "VENV_DIR=%ROOT%\backend\triage-engine\.venv"
set "SKIP_INSTALL=0"

:: Parse args
for %%A in (%*) do (
    if "%%A"=="--skip-install" set "SKIP_INSTALL=1"
)

echo.
echo  ===================================================
echo   Quack3-AJAE  —  Start All Services
echo  ===================================================
echo.

:: ── Find Python ────────────────────────────────────────────
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] python not found on PATH.
    echo         Install Python from https://python.org and ensure it is on your PATH.
    pause
    exit /b 1
)

:: ── Create venv if missing or broken ───────────────────────
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    if exist "%VENV_DIR%" (
        echo [start-all] Found broken venv — removing and recreating...
        rmdir /s /q "%VENV_DIR%"
    )
    echo [start-all] Creating Python venv at backend\triage-engine\.venv ...
    python -m venv "%VENV_DIR%"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create venv. Make sure python has the venv module.
        pause
        exit /b 1
    )
    echo   [OK] venv created
)

:: ── Activate the venv ──────────────────────────────────────
call "%VENV_DIR%\Scripts\activate.bat"
echo   [OK] venv activated
python --version
echo.

:: ── Install dependencies ───────────────────────────────────
if "%SKIP_INSTALL%"=="0" (
    echo [start-all] Installing dependencies...
    echo.

    echo [start-all] npm install — frontend\nurse-command
    pushd "%ROOT%\frontend\nurse-command"
    call npm install --silent
    if %errorlevel% equ 0 ( echo   [OK] nurse-command ready ) else ( echo   [WARN] nurse-command install had errors )
    popd

    echo [start-all] npm install — frontend\patient-client
    pushd "%ROOT%\frontend\patient-client"
    call npm install --silent
    if %errorlevel% equ 0 ( echo   [OK] patient-client ready ) else ( echo   [WARN] patient-client install had errors )
    popd

    echo [start-all] pip install — backend\triage-engine ^(inside venv^)
    pushd "%ROOT%\backend\triage-engine"
    pip install -q -r requirements.txt
    if %errorlevel% equ 0 ( echo   [OK] triage-engine deps ready ) else ( echo   [WARN] triage-engine pip install had errors )
    popd

    echo.
    echo [start-all] All dependencies installed.
    echo.
) else (
    echo [start-all] Skipping dependency installation ^(--skip-install^)
    echo.
)

:: ── Create logs directory ───────────────────────────────────
set "LOGDIR=%ROOT%\logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

:: ── Start all services in separate windows ─────────────────
::    Each service shows stdout+stderr in its window (cmd /k keeps it open)
::    stderr is merged into stdout so all errors are visible

echo [start-all] Starting nurse-command frontend on http://localhost:5173
start "nurse-command [port 5173]" /D "%ROOT%\frontend\nurse-command" cmd /k "npm run dev 2>&1"

echo [start-all] Starting patient-client frontend on http://localhost:3000
start "patient-client [port 3000]" /D "%ROOT%\frontend\patient-client" cmd /k "npm run dev 2>&1"

echo [start-all] Starting triage-engine backend on http://localhost:8000
set "PYTHONPATH=%ROOT%"
start "triage-engine [port 8000]" /D "%ROOT%\backend\triage-engine" cmd /V:ON /k "set PYTHONPATH=%ROOT%&& "%VENV_DIR%\Scripts\activate.bat" && python -m uvicorn app.main:app --reload --port 8000 2>&1"


:: ── Summary ────────────────────────────────────────────────
echo.
echo  ===================================================
echo   All services running!
echo  ===================================================
echo.
echo   nurse-command    -^>  http://localhost:5173
echo   patient-client   -^>  http://localhost:3000
echo   triage-engine    -^>  http://localhost:8000
echo.
echo   Each service shows stdout+stderr in its window.
echo   Close those windows to stop individual services.
echo  ===================================================
echo.
pause
