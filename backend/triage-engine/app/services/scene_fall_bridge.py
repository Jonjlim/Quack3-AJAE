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


def run_snapshot_analysis(
    before_bytes: bytes,
    current_bytes: bytes,
    before_mime: str = "image/jpeg",
    current_mime: str = "image/jpeg",
) -> dict:
    """Compare two camera snapshots for fall detection (legacy 2-frame mode).

    Synchronous — run via asyncio.to_thread in async endpoints.
    """
    try:
        from fall_detection import detect_fall_from_snapshots  # noqa: PLC0415
    except ImportError as exc:
        raise SceneFallUnavailableError(
            "scene-intel fall_detection is unavailable — ensure google-genai is installed "
            "and GEMINI_API_KEY is set in .env"
        ) from exc
    return detect_fall_from_snapshots(
        before_bytes, current_bytes, before_mime, current_mime
    )


def run_sequence_analysis(frames: list[tuple[bytes, str]]) -> dict:
    """Analyze a chronological sequence of camera frames for fall detection.

    Args:
        frames: List of (image_bytes, mime_type) tuples, oldest first
                (e.g. [t-9s, t-6s, t-3s, t-0s]).

    Synchronous — run via asyncio.to_thread in async endpoints.
    Returns dict with keys: fall_detected, confidence, danger_level,
    coordinates, description.
    """
    try:
        from fall_detection import detect_fall_from_sequence  # noqa: PLC0415
    except ImportError as exc:
        raise SceneFallUnavailableError(
            "scene-intel fall_detection is unavailable — ensure google-genai is installed "
            "and GEMINI_API_KEY is set in .env"
        ) from exc
    return detect_fall_from_sequence(frames)
