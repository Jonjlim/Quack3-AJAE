"""Gemini-powered case-file builder — in-memory conversation store + report generation.

Patients talk (audio or text) while waiting. Gemini asks follow-up questions to build
deep context. The nurse can later generate a structured case-file PDF for the doctor.

Gemini calls are delegated to generalFunctions/GeminiAPI.py.
"""

import asyncio
import io
import sys
import textwrap
from datetime import datetime, timezone
from pathlib import Path

# Ensure scene-intel is importable (GeminiAPI lives there)
_SCENE_INTEL = str(Path(__file__).resolve().parents[4] / "backend" / "scene-intel")
if _SCENE_INTEL not in sys.path:
    sys.path.insert(0, _SCENE_INTEL)

from generalFunctions.GeminiAPI import (  # noqa: E402
    GeminiNotConfiguredError,
    is_configured,
    query_gemini_audio,
    query_gemini_chat,
)
from shared.schemas.telemetry import CasefileMessage  # noqa: E402

_GEMINI_TIMEOUT_SECONDS = 45

# ── Editable prompts (change these to tune Gemini behaviour) ─────────────────

SYSTEM_PROMPT = textwrap.dedent("""\
    You are an empathetic ER intake assistant helping a patient while they wait
    for a doctor. Your job is to gather as much relevant medical context as
    possible through natural conversation.

    Ask about:
    - How the injury or illness happened (mechanism)
    - Specific symptoms and their severity (1-10 scale when useful)
    - When symptoms started and how they have changed
    - Medications currently taken (prescription and OTC)
    - Known allergies
    - Relevant medical history (surgeries, chronic conditions)
    - Recent food/drink intake
    - Whether anything makes the symptoms better or worse

    Rules:
    - NEVER attempt to diagnose the patient.
    - NEVER recommend treatment or medication.
    - Ask ONE or TWO follow-up questions at a time — keep it conversational.
    - Use simple, non-medical language the patient can understand.
    - If the patient reports worsening symptoms, note the time and details.
    - Be concise — patients are in discomfort.
    - If the patient seems distressed, acknowledge their feelings briefly.
""")

REPORT_PROMPT = textwrap.dedent("""\
    You are a medical scribe. Below is a conversation between a patient and an
    AI intake assistant in an emergency room. Condense the conversation into a
    structured case-file report for the attending physician.

    FORMAT (use these exact headings):

    ## Chief Complaint
    One-sentence summary of why the patient is here.

    ## History of Present Illness
    Chronological narrative: what happened, when, how symptoms progressed.

    ## Symptom Details
    Bullet list of reported symptoms with severity, location, and timing.

    ## Medications & Allergies
    Current medications and known allergies (state "None reported" if not mentioned).

    ## Relevant Medical History
    Past surgeries, chronic conditions, family history if mentioned.

    ## Symptom Timeline
    Timestamped notes of any symptom changes reported during the wait.

    ## Additional Context
    Anything else relevant (diet, activities, aggravating/alleviating factors).

    Rules:
    - DO NOT diagnose or suggest diagnoses.
    - DO NOT add information not present in the conversation.
    - Use concise, clinical language appropriate for a physician audience.
    - If information was not discussed, write "Not discussed" under that heading.
""")

AUDIO_INSTRUCTION = (
    "The patient just sent an audio message. First, transcribe what they said "
    "(prefix with 'Transcript: '). Then respond with your follow-up question "
    "on a new line after 'Response: '."
)

# ── In-memory conversation store (keyed by patient_id) ───────────────────────

_conversations: dict[str, list[CasefileMessage]] = {}


def get_conversation(patient_id: str) -> list[CasefileMessage]:
    """Return conversation history for a patient (empty list if none)."""
    return list(_conversations.get(patient_id, []))


def _append(patient_id: str, role: str, content: str) -> CasefileMessage:
    """Append a message to the conversation and return it."""
    msg = CasefileMessage(
        role=role,  # type: ignore[arg-type]
        content=content,
        timestamp=datetime.now(timezone.utc),
    )
    _conversations.setdefault(patient_id, []).append(msg)
    return msg


def _build_history(patient_id: str) -> list[dict]:
    """Convert stored messages into Gemini SDK content format."""
    history: list[dict] = []
    for msg in _conversations.get(patient_id, []):
        role = "user" if msg.role == "patient" else "model"
        history.append({"role": role, "parts": [{"text": msg.content}]})
    return history


def _ensure_gemini_ready() -> None:
    if not is_configured():
        raise GeminiNotConfiguredError(
            "AI assistant unavailable — set GEMINI_API_KEY in .env and restart the backend"
        )


async def _run_gemini(fn, *args, **kwargs):
    """Run blocking Gemini SDK calls off the event loop with a timeout."""
    _ensure_gemini_ready()
    return await asyncio.wait_for(
        asyncio.to_thread(fn, *args, **kwargs),
        timeout=_GEMINI_TIMEOUT_SECONDS,
    )


# ── Chat (audio) ─────────────────────────────────────────────────────────────

async def chat_audio(patient_id: str, audio_bytes: bytes, mime_type: str = "audio/webm") -> tuple[str, str]:
    """Send audio to Gemini, get transcription + follow-up question.

    Returns (gemini_response, transcript).
    """
    history = _build_history(patient_id)

    raw = await _run_gemini(
        query_gemini_audio,
        history=history,
        audio_bytes=audio_bytes,
        audio_prompt=AUDIO_INSTRUCTION,
        system_instruction=SYSTEM_PROMPT,
        mime_type=mime_type,
    )

    # Parse transcript and response from Gemini output
    transcript = ""
    gemini_reply = raw
    if "Transcript:" in raw and "Response:" in raw:
        parts = raw.split("Response:", 1)
        transcript_part = parts[0]
        gemini_reply = parts[1].strip() if len(parts) > 1 else raw
        transcript = transcript_part.replace("Transcript:", "").strip()
    elif "Transcript:" in raw:
        transcript = raw.replace("Transcript:", "").strip()
        gemini_reply = transcript  # fallback

    # Store both sides of the conversation
    if transcript:
        _append(patient_id, "patient", transcript)
    _append(patient_id, "gemini", gemini_reply)

    return gemini_reply, transcript


# ── Chat (text) ──────────────────────────────────────────────────────────────

async def chat_text(patient_id: str, text: str) -> tuple[str, str]:
    """Send text to Gemini, get follow-up question.

    Returns (gemini_response, original_text).
    """
    _append(patient_id, "patient", text)
    history = _build_history(patient_id)

    try:
        gemini_reply = await _run_gemini(
            query_gemini_chat,
            history=history,
            system_instruction=SYSTEM_PROMPT,
        )
    except Exception:
        # Roll back optimistic patient message on failure
        msgs = _conversations.get(patient_id, [])
        if msgs and msgs[-1].role == "patient" and msgs[-1].content == text:
            msgs.pop()
        raise

    if not gemini_reply:
        gemini_reply = "I'm sorry, I couldn't process that. Could you try again?"

    _append(patient_id, "gemini", gemini_reply)
    return gemini_reply, text


# ── Report generation ────────────────────────────────────────────────────────

async def generate_report(patient_id: str) -> str:
    """Generate a markdown case-file report from the full conversation."""
    messages = _conversations.get(patient_id, [])

    if not messages:
        return "No conversation data available for this patient."

    # Format conversation for Gemini
    convo_text = "\n".join(
        f"[{msg.timestamp.strftime('%H:%M')}] {'Patient' if msg.role == 'patient' else 'Assistant'}: {msg.content}"
        for msg in messages
    )

    report = await _run_gemini(
        query_gemini_chat,
        history=[{
            "role": "user",
            "parts": [{"text": f"Conversation transcript:\n\n{convo_text}"}],
        }],
        system_instruction=REPORT_PROMPT,
        temperature=0.2,
    )

    return report or "Report generation failed."


# ── PDF generation ───────────────────────────────────────────────────────────

async def generate_report_pdf(patient_id: str) -> bytes:
    """Generate a PDF case-file report and return raw bytes."""
    try:
        from reportlab.lib.pagesizes import LETTER
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import inch
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
    except ImportError as exc:
        raise RuntimeError(
            "PDF generation requires reportlab (pip install -r backend/triage-engine/requirements.txt)"
        ) from exc

    markdown = await generate_report(patient_id)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=LETTER,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "CaseTitle",
        parent=styles["Title"],
        fontSize=18,
        spaceAfter=12,
    )
    heading_style = ParagraphStyle(
        "CaseHeading",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=14,
        spaceAfter=6,
        textColor="#1e3a5f",
    )
    body_style = ParagraphStyle(
        "CaseBody",
        parent=styles["BodyText"],
        fontSize=10,
        leading=14,
        spaceAfter=6,
    )
    meta_style = ParagraphStyle(
        "CaseMeta",
        parent=styles["BodyText"],
        fontSize=9,
        textColor="#666666",
        spaceAfter=16,
    )

    story: list = []
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    story.append(Paragraph(f"Case File -- {patient_id}", title_style))
    story.append(Paragraph(f"Generated: {now}", meta_style))
    story.append(Spacer(1, 8))

    # Parse markdown into paragraphs
    for line in markdown.split("\n"):
        stripped = line.strip()
        if not stripped:
            story.append(Spacer(1, 4))
        elif stripped.startswith("## "):
            story.append(Paragraph(stripped[3:], heading_style))
        elif stripped.startswith("# "):
            story.append(Paragraph(stripped[2:], heading_style))
        elif stripped.startswith("- "):
            story.append(Paragraph(f"  {stripped[2:]}", body_style))
        else:
            story.append(Paragraph(stripped, body_style))

    doc.build(story)
    return buf.getvalue()
