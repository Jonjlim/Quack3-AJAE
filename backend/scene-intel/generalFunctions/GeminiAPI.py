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
VIDEO_MODEL = "gemini-3.1-flash-lite"
TEXT_MODEL = "gemini-3.1-flash-lite"
AUDIO_MODEL = "gemini-3.1-flash-lite"


class GeminiNotConfiguredError(RuntimeError):
    """Raised when GEMINI_API_KEY is missing."""


def is_configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY", "").strip())


def _get_client():
    """Lazy-initialize and cache the Gemini client."""
    global _client
    if _client is None:
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise GeminiNotConfiguredError(
                "GEMINI_API_KEY not set — add it to .env at the project root"
            )
        _client = genai.Client(api_key=api_key)
    return _client


def _history_to_contents(history: list[dict]) -> list[types.Content]:
    """Convert legacy history dicts into SDK Content objects."""
    contents: list[types.Content] = []
    for item in history:
        role = item["role"]
        parts: list[types.Part] = []
        for part in item.get("parts", []):
            if "text" in part:
                parts.append(types.Part.from_text(text=part["text"]))
            elif "inline_data" in part:
                inline = part["inline_data"]
                parts.append(
                    types.Part.from_bytes(
                        data=inline["data"],
                        mime_type=inline["mime_type"],
                    )
                )
        if parts:
            contents.append(types.Content(role=role, parts=parts))
    return contents


# ── Video query (existing) ───────────────────────────────────────────────────

def query_gemini_video(prompt, video_bytes, mime_type="video/mp4"):
    """Send a video + text prompt to Gemini and return the text response."""
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

    return response.text or ""


# ── Text chat ────────────────────────────────────────────────────────────────

def query_gemini_chat(history, system_instruction, temperature=0.4, model=TEXT_MODEL):
    """Send a multi-turn text conversation to Gemini."""
    client = _get_client()
    contents = _history_to_contents(history) if history else []

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    )

    return response.text or ""


# ── Audio chat ───────────────────────────────────────────────────────────────

def query_gemini_audio(
    history,
    audio_bytes,
    audio_prompt,
    system_instruction,
    mime_type="audio/webm",
    temperature=0.4,
    model=AUDIO_MODEL,
):
    """Send conversation history + an audio clip to Gemini."""
    client = _get_client()

    contents = _history_to_contents(history)
    contents.append(
        types.Content(
            role="user",
            parts=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                types.Part.from_text(text=audio_prompt),
            ],
        )
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=temperature,
        ),
    )

    return response.text or ""
