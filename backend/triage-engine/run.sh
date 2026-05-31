#!/usr/bin/env bash
# Run triage-engine from repo root so shared/ imports resolve.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export PYTHONPATH="$ROOT:$ROOT/backend/rppg"
cd "$ROOT/backend/triage-engine"
if [[ -x ".venv/bin/python3.11" ]]; then
  PYTHON=".venv/bin/python3.11"
elif [[ -x ".venv/bin/python" ]]; then
  PYTHON=".venv/bin/python"
else
  PYTHON="python3.11"
fi
exec "$PYTHON" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 "$@"
