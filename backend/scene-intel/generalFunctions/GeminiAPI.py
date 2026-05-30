"""Gemini API wrapper for video analysis."""

import os
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load .env from project root
_ENV_PATH = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_ENV_PATH)

_client = None
_MODEL = "gemini-2.5-flash"


def _get_client():
    """Lazy-initialize and cache the Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set in .env")
        _client = genai.Client(api_key=api_key)
    return _client


def query_gemini_video(prompt, video_bytes, mime_type="video/mp4"):
    """Send a video + text prompt to Gemini and return the text response.

    Args:
        prompt: Text instructions for the model.
        video_bytes: Raw video file bytes.
        mime_type: MIME type of the video (default: video/mp4).

    Returns:
        The model's text response as a string.
    """
    client = _get_client()

    response = client.models.generate_content(
        model=_MODEL,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=prompt),
                    types.Part.from_bytes(data=video_bytes, mime_type=mime_type),
                ],
            )
        ],
    )

    return response.text
