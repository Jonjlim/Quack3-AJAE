"""Fall detection using Gemini API video analysis."""

import json
from generalFunctions.GeminiAPI import query_gemini_video

_PROMPT = """You are an elderly care fall detection system analyzing a 5-second video clip from a monitoring camera.

Analyze the video for any falls or fall-like events. Evaluate:
1. Whether a fall occurred
2. Your confidence level (0.0 to 1.0)
3. The danger level: "low", "medium", or "high"
4. If a fall occurred, the approximate pixel coordinates (x, y) of the center of the fall
5. If a fall occurred, the approximate timestamp in seconds within the clip

Respond with ONLY valid JSON in this exact format, no other text:
{
    "fall_detected": true or false,
    "confidence": 0.0 to 1.0,
    "danger_level": "low" or "medium" or "high",
    "coordinates": {"x": int, "y": int} or null,
    "frame_timestamp": float or null
}"""

_DEFAULT_RESULT = {
    "fall_detected": False,
    "confidence": 0.0,
    "danger_level": "low",
    "coordinates": None,
    "frame_timestamp": None,
}


def _parse_response(raw):
    """Parse Gemini's JSON text response into a structured dict.

    Falls back to defaults if the response is malformed.
    """
    try:
        # Strip markdown code fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]

        data = json.loads(text.strip())
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
        return dict(_DEFAULT_RESULT)


def detect_fall(video):
    """Detect falls in a 5-second video clip.

    Args:
        video: Raw video bytes (e.g. mp4).

    Returns:
        dict with keys: fall_detected, confidence, danger_level,
        coordinates, frame_timestamp.
    """
    raw = query_gemini_video(_PROMPT, video)
    return _parse_response(raw)
