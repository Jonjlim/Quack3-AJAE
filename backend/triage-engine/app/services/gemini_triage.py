"""Gemini-powered triage acuity suggestion from chief complaint."""

import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

_ENV_PATH = Path(__file__).resolve().parents[4] / ".env"
load_dotenv(_ENV_PATH)

logger = logging.getLogger(__name__)

_client = None
_MODEL = "gemini-2.5-flash"

_PROMPT_TEMPLATE = """You are a clinical decision-support assistant for an emergency department.
A patient has just checked in via a kiosk and described their chief complaint.
Your role is to provide a brief clinical observation note to help the triage nurse prioritise their assessment.

IMPORTANT:
- You are NOT assigning an acuity level — that decision belongs to the human nurse.
- Write 1-2 sentences (≤ 60 words) of clinical observations: flag any potential red-flag symptoms,
  mention relevant differentials to consider, or note what the nurse should assess first.
- Do not repeat the chief complaint verbatim.
- Do not give a diagnosis or a triage category.
- Use plain clinical language.

Patient chief complaint: {complaint}

Respond with ONLY valid JSON, no other text:
{{"analysis": "<your clinical observation note here>"}}"""


def _get_client():
    global _client
    if _client is None:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set")
        _client = genai.Client(api_key=api_key)
    return _client


def suggest_acuity(chief_complaint: str) -> dict:
    """Ask Gemini for a clinical observation note on a patient's chief complaint.

    Returns a dict with key: analysis (str | None).
    The human nurse makes the final acuity decision; this is advisory only.
    """
    try:
        from google.genai import types
        client = _get_client()
        prompt = _PROMPT_TEMPLATE.format(complaint=chief_complaint)
        response = client.models.generate_content(
            model=_MODEL,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
        )
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        data = json.loads(text.strip())
        analysis = str(data.get("analysis") or "").strip()
        return {"analysis": analysis or None}
    except Exception as exc:
        logger.warning("Gemini clinical analysis failed: %s", exc)
        return {"analysis": None}
