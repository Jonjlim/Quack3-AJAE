"""Bridge to backend/scene-intel analysis modules."""

import base64
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
SCENE_INTEL_ROOT = REPO_ROOT / "backend" / "scene-intel"

if str(SCENE_INTEL_ROOT) not in sys.path:
    sys.path.insert(0, str(SCENE_INTEL_ROOT))

FALL_CONFIDENCE_THRESHOLD = 0.6


class SceneIntelUnavailableError(RuntimeError):
    pass


def _import_fall_detector():
    try:
        from fall_detection.detector import detect_fall

        return detect_fall
    except ImportError as exc:
        raise SceneIntelUnavailableError(
            "Fall detection dependencies not installed. "
            "Run: pip install -r backend/scene-intel/requirements.txt"
        ) from exc


def _import_rppg():
    try:
        from rppg.rppg import detect_rppg

        return detect_rppg
    except ImportError as exc:
        raise SceneIntelUnavailableError(
            "rPPG dependencies not installed. "
            "Run: pip install -r backend/scene-intel/requirements.txt"
        ) from exc


def run_fall_detection(video_bytes: bytes) -> dict:
    detect_fall = _import_fall_detector()
    return detect_fall(video_bytes)


def run_rppg_analysis(video_bytes: bytes) -> dict:
    detect_rppg = _import_rppg()
    video_b64 = base64.b64encode(video_bytes).decode("utf-8")
    return detect_rppg(video_b64)


def should_fire_fall_alert(result: dict) -> bool:
    if not result.get("fall_detected"):
        return False
    confidence = float(result.get("confidence", 0.0))
    danger = str(result.get("danger_level", "low"))
    return confidence >= FALL_CONFIDENCE_THRESHOLD and danger in ("medium", "high")
