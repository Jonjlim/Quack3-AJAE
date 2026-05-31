#!/usr/bin/env bash
# Launch nurse-command + patient-client + triage-engine (loads Quack3-AJAE/.env for LiveKit).
#
#   bash start-all.sh                  # install deps & start
#   bash start-all.sh --skip-install   # skip npm/pip install
#
# Ctrl-C once to stop all services.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$ROOT/backend/triage-engine/.venv"
ENV_FILE="$ROOT/.env"
SKIP_INSTALL=false

for arg in "$@"; do
  case "$arg" in
    --skip-install) SKIP_INSTALL=true ;;
  esac
done

free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti :"$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "[start-all] Stopping process on port $port ($pids)"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

echo ""
echo " ==================================================="
echo "  Quack3-AJAE  —  Start All Services"
echo " ==================================================="
echo ""

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
  echo "  [OK] loaded $ENV_FILE"
else
  echo "  [WARN] no $ENV_FILE — LiveKit will use dev defaults (camera will fail)"
  echo "         copy .env.example to .env and add LIVEKIT_* credentials"
fi
echo ""

if command -v python3 &>/dev/null; then
  SYS_PYTHON="python3"
elif command -v python &>/dev/null; then
  SYS_PYTHON="python"
else
  echo "[ERROR] No python3 or python found on PATH."
  exit 1
fi

find_activate() {
  if [ -f "$VENV_DIR/bin/activate" ]; then
    echo "$VENV_DIR/bin/activate"
  elif [ -f "$VENV_DIR/Scripts/activate" ]; then
    echo "$VENV_DIR/Scripts/activate"
  fi
}

ACTIVATE_SCRIPT="$(find_activate)"
if [ -z "$ACTIVATE_SCRIPT" ]; then
  if [ -d "$VENV_DIR" ]; then
    echo "[start-all] Removing broken venv..."
    rm -rf "$VENV_DIR"
  fi
  echo "[start-all] Creating Python venv at backend/triage-engine/.venv..."
  $SYS_PYTHON -m venv "$VENV_DIR"
  ACTIVATE_SCRIPT="$(find_activate)"
  if [ -z "$ACTIVATE_SCRIPT" ]; then
    echo "[ERROR] venv created but activate script not found."
    exit 1
  fi
fi

# shellcheck source=/dev/null
source "$ACTIVATE_SCRIPT"
echo "  [OK] venv activated ($(python --version))"
echo ""

if [ "$SKIP_INSTALL" = false ]; then
  echo "[start-all] Installing dependencies (first pip install can take several minutes)..."
  echo ""
  (cd "$ROOT/frontend/nurse-command" && npm install --silent)
  echo "  [OK] nurse-command"
  (cd "$ROOT/frontend/patient-client" && npm install --silent)
  echo "  [OK] patient-client"
  (cd "$ROOT/backend/triage-engine" && pip install -r requirements.txt)
  echo "  [OK] triage-engine"
  echo ""
else
  echo "[start-all] Skipping dependency installation (--skip-install)"
  echo ""
fi

echo "[start-all] Freeing dev ports 8000, 5173, 3000..."
free_port 8000
free_port 5173
free_port 3000
echo ""

PIDS=()

cleanup() {
  echo ""
  echo "[start-all] Shutting down…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "[start-all] Done."
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "[start-all] Starting triage-engine on http://localhost:8000"
export PYTHONPATH="$ROOT"
(cd "$ROOT/backend/triage-engine" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000) &
PIDS+=($!)
sleep 2

if curl -sf http://localhost:8000/health >/dev/null 2>&1; then
  echo "  [OK] triage-engine health"
else
  echo "  [WARN] triage-engine not responding yet — check logs above"
fi

echo "[start-all] Starting nurse-command (http://localhost:5173)"
(cd "$ROOT/frontend/nurse-command" && npm run dev) &
PIDS+=($!)

echo "[start-all] Starting patient-client (https://localhost:3000)"
(cd "$ROOT/frontend/patient-client" && npm run dev) &
PIDS+=($!)

echo ""
echo " ==================================================="
echo "  Services started"
echo " ==================================================="
echo "  triage-engine    http://localhost:8000"
echo "  nurse-command    http://localhost:5173  (or :5174 if busy)"
echo "  patient-client   https://localhost:3000  ← use HTTPS for camera"
echo ""
echo "  LiveKit: check token uses your cloud URL, not devkey:"
echo "    curl -s -X POST http://localhost:8000/api/v1/livekit/token \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"room\":\"er-waiting-room\",\"identity\":\"test\",\"role\":\"patient\"}'"
echo ""
echo "  Patient flow: nurse check-in → open queue URL with your patient_id"
echo "  Press Ctrl-C to stop all."
echo " ==================================================="
echo ""

set +e
wait
set -e
