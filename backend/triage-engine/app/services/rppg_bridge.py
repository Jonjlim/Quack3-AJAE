"""Bridge to backend/rppg analysis (in-process import)."""

import base64
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
RPPG_ROOT = REPO_ROOT / "backend" / "rppg"

if str(RPPG_ROOT) not in sys.path:
    sys.path.insert(0, str(RPPG_ROOT))


class RppgUnavailableError(RuntimeError):
    pass


def _import_rppg():
    try:
        from rppg import detect_rppg

        return detect_rppg
    except ImportError as exc:
        raise RppgUnavailableError(
            "rPPG dependencies not installed. Run: pip install -r backend/rppg/requirements.txt"
        ) from exc


def run_rppg_analysis(video_bytes: bytes) -> dict:
    detect_rppg = _import_rppg()
    video_b64 = base64.b64encode(video_bytes).decode("utf-8")
    return detect_rppg(video_b64)
