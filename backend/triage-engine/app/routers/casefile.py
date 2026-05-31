"""Case-file REST endpoints — audio/text chat + report generation."""

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response

from app.services import casefile as cf
from shared.schemas.telemetry import (
    CasefileChatRequest,
    CasefileChatResponse,
    CasefileConversation,
    CasefileReportResponse,
)

router = APIRouter(prefix="/api/v1/casefile", tags=["casefile"])


@router.post("/{patient_id}/chat", response_model=CasefileChatResponse)
async def chat_audio(patient_id: str, audio: UploadFile = File(...)) -> CasefileChatResponse:
    """Accept audio blob, send to Gemini, return response + transcript."""
    audio_bytes = await audio.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Detect MIME type from upload or default to webm
    mime = audio.content_type or "audio/webm"
    response, transcript = await cf.chat_audio(patient_id, audio_bytes, mime)
    messages = cf.get_conversation(patient_id)

    return CasefileChatResponse(
        response=response,
        transcript=transcript,
        message_count=len(messages),
    )


@router.post("/{patient_id}/chat-text", response_model=CasefileChatResponse)
async def chat_text(patient_id: str, body: CasefileChatRequest) -> CasefileChatResponse:
    """Accept text input, send to Gemini, return response."""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Empty text")

    response, transcript = await cf.chat_text(patient_id, body.text.strip())
    messages = cf.get_conversation(patient_id)

    return CasefileChatResponse(
        response=response,
        transcript=transcript,
        message_count=len(messages),
    )


@router.get("/{patient_id}/conversation", response_model=CasefileConversation)
async def get_conversation(patient_id: str) -> CasefileConversation:
    """Return full conversation history for a patient."""
    messages = cf.get_conversation(patient_id)
    return CasefileConversation(
        patient_id=patient_id,
        messages=messages,
        started_at=messages[0].timestamp if messages else None,
    )


@router.get("/{patient_id}/report", response_model=CasefileReportResponse)
async def get_report(patient_id: str) -> CasefileReportResponse:
    """Generate a markdown case-file report on demand."""
    messages = cf.get_conversation(patient_id)
    if not messages:
        raise HTTPException(status_code=404, detail="No conversation found for this patient")

    markdown = await cf.generate_report(patient_id)
    return CasefileReportResponse(
        patient_id=patient_id,
        report_markdown=markdown,
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/{patient_id}/report-pdf")
async def get_report_pdf(patient_id: str) -> Response:
    """Generate and download a PDF case-file report."""
    messages = cf.get_conversation(patient_id)
    if not messages:
        raise HTTPException(status_code=404, detail="No conversation found for this patient")

    pdf_bytes = await cf.generate_report_pdf(patient_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="casefile-{patient_id}.pdf"',
        },
    )
