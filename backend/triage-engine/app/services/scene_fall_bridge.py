"""Bridge to backend/scene-intel fall detection (in-process import).

Mirrors the rppg_bridge pattern: inserts scene-intel onto sys.path so the
triage-engine can call detect_fall() without an extra sub-process.
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
SCENE_INTEL_ROOT = REPO_ROOT / "backend" / "scene-intel"

if str(SCENE_INTEL_ROOT) not in sys.path:
    sys.path.insert(0, str(SCENE_INTEL_ROOT))


class SceneFallUnavailableError(RuntimeError):
    """Raised when scene-intel or Gemini dependencies are not available."""


def _import_detector():
    try:
        from fall_detection import detect_fall  # noqa: PLC0415

        return detect_fall
    except ImportError as exc:
        raise SceneFallUnavailableError(
            "scene-intel fall_detection is unavailable — ensure google-genai is installed "
            "and GEMINI_API_KEY is set in .env"
        ) from exc


def run_fall_analysis(video_bytes: bytes, mime_type: str = "video/webm") -> dict:
    """Run Gemini video fall analysis synchronously (call via asyncio.to_thread)."""
    detect_fall = _import_detector()
    return detect_fall(video_bytes, mime_type=mime_type)
