"""OpenAI Vision hazard parser — structured JSON hazard reports."""

import base64
import json
import os
from typing import Any

import cv2
import numpy as np
from openai import OpenAI


def frame_to_base64(frame: np.ndarray) -> str:
    _, buffer = cv2.imencode(".jpg", frame)
    return base64.b64encode(buffer).decode("utf-8")


def parse_hazard(frame: np.ndarray, prompt: str | None = None) -> dict[str, Any]:
    """
    Send a frame to OpenAI Vision and return a structured hazard report.
    Returns a stub response when OPENAI_API_KEY is not set.
    """
    default_prompt = (
        "Analyze this ER waiting room frame. Return JSON with keys: "
        "hazard_detected (bool), hazard_type (string|null), severity (LOW|MEDIUM|HIGH|CRITICAL), "
        "description (string)."
    )

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {
            "hazard_detected": False,
            "hazard_type": None,
            "severity": "LOW",
            "description": "OpenAI API key not configured — stub response",
        }

    client = OpenAI(api_key=api_key)
    b64 = frame_to_base64(frame)
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt or default_prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}"},
                    },
                ],
            }
        ],
        response_format={"type": "json_object"},
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)
