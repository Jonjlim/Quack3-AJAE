"""Fall detection using Gemini API video analysis."""

import json
from generalFunctions.GeminiAPI import query_gemini_video

_PROMPT = """You are a hospital emergency room fall-detection system analyzing a short video clip from a fixed overhead monitoring camera.

Examine the clip for TWO DISTINCT medical emergency events:

FALL: A person rapidly and uncontrollably transitioned from upright or seated to a floor-level position.
  - Look for sudden downward motion, loss of balance, or body rotation toward the floor.
  - Do NOT classify intentional crouching, bending over, or sitting down as a fall.

COLLAPSE/UNCONSCIOUS: A person is lying or sprawled on the floor with NO intentional movement for at least 1.5 consecutive seconds.
  - Distinguish this from a person who fell but immediately got back up (not a collapse).

For each clip, evaluate:
1. fall_detected — true if a rapid, uncontrolled fall motion was observed at any point in the clip.
2. person_collapsed — true if a person appears motionless on the floor for 3 or more seconds.
3. confidence — your overall certainty that a real medical emergency is occurring (0.0 to 1.0).
   Use >= 0.8 only when evidence is unambiguous. Use < 0.5 when there is significant ambiguity.
4. danger_level — "high" if person is collapsed/unconscious or fell without recovering;
                   "medium" if person fell but recovered/is moving;
                   "low" if no emergency is present.
5. coordinates — approximate pixel (x, y) of the center of the person in distress; null if no emergency.
6. frame_timestamp — seconds into the clip when the emergency first became visible; null if no emergency.

Respond with ONLY valid JSON in this exact format, no other text:
{
    "fall_detected": true or false,
    "person_collapsed": true or false,
    "confidence": 0.0 to 1.0,
    "danger_level": "low" or "medium" or "high",
    "coordinates": {"x": int, "y": int} or null,
    "frame_timestamp": float or null
}"""

_DEFAULT_RESULT = {
    "fall_detected": False,
    "person_collapsed": False,
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
            "person_collapsed": bool(data.get("person_collapsed", False)),
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


def detect_fall(video, mime_type="video/webm"):
    """Detect falls in a 5-second video clip.

    Args:
        video: Raw video bytes.
        mime_type: MIME type of the video (e.g. 'video/webm', 'video/mp4').

    Returns:
        dict with keys: fall_detected, confidence, danger_level,
        coordinates, frame_timestamp.
    """
    raw = query_gemini_video(_PROMPT, video, mime_type=mime_type)
    return _parse_response(raw)
