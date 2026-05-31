"""Shared Gemini API wrapper — single client for all backend features.

Provides lazy-initialized client and helper functions for text chat,
audio chat, and video analysis. All Gemini calls go through here.
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load .env from project root
_ENV_PATH = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(_ENV_PATH)

_client = None

# ── Model constants (change these to switch models) ──────────────────────────
VIDEO_MODEL = "gemini-3.1-flash-lite"   # Used for video analysis
TEXT_MODEL  = "gemini-3.1-flash-lite"   # Used for multi-turn text chat
AUDIO_MODEL = "gemini-3.1-flash-lite"   # Used`` for audio transcription + chat


def _get_client():
    """Lazy-initialize and cache the Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set in .env")
        _client = genai.Client(api_key=api_key)
    return _client


# ── Video query (existing) ───────────────────────────────────────────────────

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
        model=VIDEO_MODEL,
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


# ── Text chat ────────────────────────────────────────────────────────────────

def query_gemini_chat(history, system_instruction, temperature=0.4, model=TEXT_MODEL):
    """Send a multi-turn text conversation to Gemini.

    Args:
        history: List of content dicts [{"role": "user"|"model", "parts": [{"text": ...}]}].
        system_instruction: System prompt string.
        temperature: Sampling temperature (lower = more focused).
        model: Gemini model name.

    Returns:
        The model's text response as a string.
    """
    client = _get_client()

    response = client.models.generate_content(
        model=model,
        contents=history,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    )

    return response.text or ""


# ── Audio chat ───────────────────────────────────────────────────────────────

def query_gemini_audio(history, audio_bytes, audio_prompt, system_instruction,
                       mime_type="audio/webm", temperature=0.4, model=AUDIO_MODEL):
    """Send conversation history + an audio clip to Gemini.

    Args:
        history: Prior conversation as content dicts.
        audio_bytes: Raw audio file bytes.
        audio_prompt: Text prompt to accompany the audio.
        system_instruction: System prompt string.
        mime_type: MIME type of the audio (default: audio/webm).
        temperature: Sampling temperature.
        model: Gemini model name.

    Returns:
        The model's text response as a string.
    """
    client = _get_client()

    # Build contents: history + new audio message
    contents = list(history)
    contents.append({
        "role": "user",
        "parts": [
            {"inline_data": {"mime_type": mime_type, "data": audio_bytes}},
            {"text": audio_prompt},
        ],
    })

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    )

    return response.text or ""
