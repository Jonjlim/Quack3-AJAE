#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  start-all.sh — Launch both frontends + triage-engine backend
#
#  Usage:
#    bash ./start-all.sh                  # install deps & start
#    bash ./start-all.sh --skip-install   # skip npm/pip install
#
#  Ctrl-C once to gracefully stop ALL processes.
#
#  Python packages are installed inside a venv at
#  backend/triage-engine/.venv
# ─────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$ROOT/backend/triage-engine/.venv"
SKIP_INSTALL=false

for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=true ;;
  esac
done

echo ""
echo " ==================================================="
echo "  Quack3-AJAE  —  Start All Services"
echo " ==================================================="
echo ""

# ── Find Python ────────────────────────────────────────────
if command -v python3 &>/dev/null; then
  SYS_PYTHON="python3"
elif command -v python &>/dev/null; then
  SYS_PYTHON="python"
else
  echo "[ERROR] No python3 or python found on PATH."
  exit 1
fi

# ── Helper: find the venv activate script ───────────────────
find_activate() {
  if [ -f "$VENV_DIR/bin/activate" ]; then
    echo "$VENV_DIR/bin/activate"
  elif [ -f "$VENV_DIR/Scripts/activate" ]; then
    echo "$VENV_DIR/Scripts/activate"
  fi
}

# ── Create venv if missing or broken ───────────────────────
ACTIVATE_SCRIPT="$(find_activate)"
if [ -z "$ACTIVATE_SCRIPT" ]; then
  if [ -d "$VENV_DIR" ]; then
    echo "[start-all] Found broken venv — removing and recreating..."
    rm -rf "$VENV_DIR"
  fi
  echo "[start-all] Creating Python venv at backend/triage-engine/.venv (this may take a minute)..."
  $SYS_PYTHON -m venv "$VENV_DIR"
  echo "  [OK] venv created"

  ACTIVATE_SCRIPT="$(find_activate)"
  if [ -z "$ACTIVATE_SCRIPT" ]; then
    echo "[ERROR] venv created but activate script not found."
    exit 1
  fi
fi

# ── Activate the venv ──────────────────────────────────────
source "$ACTIVATE_SCRIPT"
echo "  [OK] venv activated ($(python --version))"
echo ""

# ── Install dependencies ───────────────────────────────────
if [ "$SKIP_INSTALL" = false ]; then
  echo "[start-all] Installing dependencies..."
  echo ""

  echo "[start-all] npm install — frontend/nurse-command"
  (cd "$ROOT/frontend/nurse-command" && npm install --silent)
  echo "  [OK] nurse-command ready"

  echo "[start-all] npm install — frontend/patient-client"
  (cd "$ROOT/frontend/patient-client" && npm install --silent)
  echo "  [OK] patient-client ready"

  echo "[start-all] pip install — backend/triage-engine (inside venv)"
  (cd "$ROOT/backend/triage-engine" && pip install -q -r requirements.txt)
  echo "  [OK] triage-engine deps ready"

  echo ""
  echo "[start-all] All dependencies installed."
  echo ""
else
  echo "[start-all] Skipping dependency installation (--skip-install)"
  echo ""
fi

# ── Collect PIDs so we can clean up on Ctrl-C ───────────────
PIDS=()

cleanup() {
  echo ""
  echo "[start-all] Shutting down all processes…"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null
  echo "[start-all] All processes stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

# ── Start nurse-command frontend (Vite — port 5173) ────────
echo "[start-all] Starting nurse-command frontend on http://localhost:5173"
(cd "$ROOT/frontend/nurse-command" && npm run dev) &
PIDS+=($!)

# ── Start patient-client frontend (Next.js — port 3000) ────
echo "[start-all] Starting patient-client frontend on http://localhost:3000"
(cd "$ROOT/frontend/patient-client" && npm run dev) &
PIDS+=($!)

# ── Start triage-engine backend (uvicorn — port 8000) ──────
echo "[start-all] Starting triage-engine backend on http://localhost:8000"
export PYTHONPATH="$ROOT"
(cd "$ROOT/backend/triage-engine" && python -m uvicorn app.main:app --reload --port 8000) &
PIDS+=($!)

# ── Summary ─────────────────────────────────────────────────
echo ""
echo " ==================================================="
echo "  All services running!"
echo " ==================================================="
echo ""
echo "  nurse-command    ->  http://localhost:5173"
echo "  patient-client   ->  http://localhost:3000"
echo "  triage-engine    ->  http://localhost:8000"
echo ""
echo "  Press Ctrl-C to stop all services."
echo " ==================================================="
echo ""

# ── Wait forever until Ctrl-C ──────────────────────────────
wait
