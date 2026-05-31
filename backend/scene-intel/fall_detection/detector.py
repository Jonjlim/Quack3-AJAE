"""Fall detection using Gemini API — video clip, dual-snapshot, and sequence modes."""

import json

from generalFunctions.GeminiAPI import query_gemini_images, query_gemini_video

# ── Video-clip prompt (legacy) ────────────────────────────────────────────────

_PROMPT_VIDEO = """You are a hospital urgent care fall detection system analyzing a video clip from a monitoring camera.

Analyze the video for anyone that might've fallen unconscious or slumped down (indicating poor health). Ensure that you dont get false positives from poor posture/people bending 
Evaluate:
1. Whether a fall or slump occurred
2. Whether anyone in the frame fell unconscious or slumped
3. Your confidence level (0.0 to 1.0)
4. The danger level: "low", "medium", or "high"
5. If someone is determined to have fallen unconscious or slumped, the approximate pixel coordinates (x, y) of the center of that person.
6. If someone is determined to have fallen unconscious or slumped, the approximate timestamp in seconds within the clip.

Respond with ONLY valid JSON in this exact format, no other text:
{
    "fall_detected": true or false,
    "confidence": 0.0 to 1.0,
    "danger_level": "low" or "medium" or "high",
    "coordinates": {"x": int, "y": int} or null,
    "frame_timestamp": float or null
}"""

# ── 4-frame sequence prompt ───────────────────────────────────────────────────

_PROMPT_SEQUENCE = """You are an AI medical monitoring system for a hospital emergency room. You are given FOUR surveillance camera frames captured 3 seconds apart in chronological order:

  • Frame 1 — 9 seconds ago  (oldest)
  • Frame 2 — 6 seconds ago
  • Frame 3 — 3 seconds ago
  • Frame 4 — NOW (current)

Analyze the FULL SEQUENCE to determine whether any person has collapsed, fallen unconscious, or is showing signs of a medical emergency across this 9-second window.

WHAT TO FLAG — set fall_detected=true for ANY of the following:
- A person who was upright or moving in earlier frames and is now on the floor.
- A person who was sitting normally and is now slumped over, limp, or with their head dropped (collapsed in a chair counts).
- Progressive collapse visible across frames — e.g. increasingly leaning, then fully slumped.
- Any person who appears unresponsive or in a collapsed state that differs from their earlier posture.
- Scan EVERY region of every frame, including small or distant figures. Even far-away people matter.

WHAT NOT TO FLAG:
- Someone already in the same position across ALL four frames (no change throughout the sequence).
- Intentional movements: bending to pick something up, crouching briefly, lying down deliberately.
- Camera artifacts, lighting changes, or objects moving with no person involved.

SENSITIVITY: Err on the side of flagging. A false positive a nurse can dismiss is far better than missing a real emergency. If there is a reasonable possibility someone collapsed across this sequence — flag it.

When fall_detected=true, provide pixel (x, y) of the CENTER of the affected person in Frame 4 (the current image).

Respond with ONLY valid JSON — no markdown, no extra text:
{
    "fall_detected": true or false,
    "confidence": 0.0 to 1.0,
    "danger_level": "low" or "medium" or "high",
    "coordinates": {"x": int, "y": int} or null,
    "description": "one sentence describing the change observed across the 9-second sequence" or null
}

Field rules:
- "fall_detected": true if any person shows collapse or loss of consciousness compared to their earlier frames.
- "confidence": 0.9–1.0 = very clear; 0.6–0.89 = probable; 0.4–0.59 = possible — all three should be true.
- "danger_level": "high" = clearly unresponsive on floor or in seat; "medium" = likely collapsed; "low" = possible but uncertain.
- "coordinates": center of affected person in Frame 4; null only if no fall.
- "description": what changed across the 9-second sequence."""

# ── Defaults ──────────────────────────────────────────────────────────────────

_DEFAULT_VIDEO_RESULT = {
    "fall_detected": False,
    "confidence": 0.0,
    "danger_level": "low",
    "coordinates": None,
    "frame_timestamp": None,
}

_DEFAULT_SEQUENCE_RESULT = {
    "fall_detected": False,
    "confidence": 0.0,
    "danger_level": "low",
    "coordinates": None,
    "description": None,
}

# ── Response parsers ──────────────────────────────────────────────────────────

def _strip_fences(raw: str) -> str:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]
    return text.strip()


def _parse_video_response(raw: str) -> dict:
    try:
        data = json.loads(_strip_fences(raw))
        return {
            "fall_detected": bool(data.get("fall_detected", False)),
            "confidence": float(data.get("confidence", 0.0)),
            "danger_level": str(data.get("danger_level", "low")),
            "coordinates": data.get("coordinates"),
            "frame_timestamp": (
                float(data["frame_timestamp"])
                if data.get("frame_timestamp") is not None
                else None
            ),
        }
    except (json.JSONDecodeError, KeyError, ValueError):
        return dict(_DEFAULT_VIDEO_RESULT)


def _parse_sequence_response(raw: str) -> dict:
    try:
        data = json.loads(_strip_fences(raw))
        return {
            "fall_detected": bool(data.get("fall_detected", False)),
            "confidence": float(data.get("confidence", 0.0)),
            "danger_level": str(data.get("danger_level", "low")),
            "coordinates": data.get("coordinates"),
            "description": data.get("description"),
        }
    except (json.JSONDecodeError, KeyError, ValueError):
        return dict(_DEFAULT_SEQUENCE_RESULT)


# ── Public API ────────────────────────────────────────────────────────────────

def detect_fall(video: bytes, mime_type: str = "video/webm") -> dict:
    """Detect falls in a video clip (legacy / clip-based mode).

    Returns dict with keys: fall_detected, confidence, danger_level,
    coordinates, frame_timestamp.
    """
    raw = query_gemini_video(_PROMPT_VIDEO, video, mime_type=mime_type)
    return _parse_video_response(raw)


def detect_fall_from_snapshots(
    before_image: bytes,
    current_image: bytes,
    before_mime: str = "image/jpeg",
    current_mime: str = "image/jpeg",
) -> dict:
    """Detect falls by comparing two camera snapshots (legacy 2-frame mode).

    Kept for backward compatibility. Prefer detect_fall_from_sequence.
    """
    raw = query_gemini_images(
        _PROMPT_SEQUENCE,
        [(before_image, before_mime), (current_image, current_mime)],
    )
    return _parse_sequence_response(raw)


def detect_fall_from_sequence(
    frames: list[tuple[bytes, str]],
) -> dict:
    """Detect falls from a chronological sequence of camera frames.

    Args:
        frames: List of (image_bytes, mime_type) tuples in chronological order,
                oldest first (e.g. [t-9s, t-6s, t-3s, t-0s]).

    Returns:
        dict with keys: fall_detected, confidence, danger_level,
        coordinates, description.
    """
    raw = query_gemini_images(_PROMPT_SEQUENCE, frames)
    return _parse_sequence_response(raw)
