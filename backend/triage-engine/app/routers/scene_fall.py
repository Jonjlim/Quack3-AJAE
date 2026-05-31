"""Room-camera fall detection via Gemini video clip analysis.

Endpoint: POST /api/v1/alerts/analyze-clip
Accepts a 10-second video clip (multipart/form-data), runs Gemini-powered
fall detection from backend/scene-intel, and — when a fall is confirmed —
creates and broadcasts a CRITICAL_FALL alert to all nurse WebSocket clients.
"""

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.deps.auth import require_firebase_user
from app.firebase_app import FirebaseUser
from app.services.events import EventBus
from app.services.fall_alerts import build_fall_message, should_accept_fall_report
from app.services.scene_fall_bridge import SceneFallUnavailableError, run_fall_analysis
from app.services.state import state_service
from app.ws.manager import manager
from shared.schemas.telemetry import ClipFallAnalysisResponse

router = APIRouter(prefix="/api/v1", tags=["scene-fall"])
events = EventBus(manager, state_service)


@router.post("/alerts/analyze-clip", response_model=ClipFallAnalysisResponse)
async def analyze_fall_clip(
    clip: Annotated[UploadFile, File(description="10-second video clip (webm or mp4)")],
    room_name: Annotated[str | None, Form()] = None,
    patient_id: Annotated[str | None, Form()] = None,
    mime_type: Annotated[str, Form()] = "video/webm",
    _user: FirebaseUser = Depends(require_firebase_user),
) -> ClipFallAnalysisResponse:
    """Analyze a 10-second room-camera clip for falls using Gemini.

    The frontend sends overlapping 10-second clips every 8 seconds.  The backend
    runs scene-intel's detect_fall() (Gemini 2.5 Flash video analysis) and, when a
    fall is detected above the confidence threshold, creates a CRITICAL_FALL alert
    and broadcasts it to all connected nurses via WebSocket.
    """
    video_bytes = await clip.read()
    if not video_bytes:
        raise HTTPException(status_code=400, detail="Empty video clip")

    try:
        result = await asyncio.to_thread(run_fall_analysis, video_bytes, mime_type)
    except SceneFallUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    fall_detected: bool = bool(result.get("fall_detected", False))
    confidence: float = float(result.get("confidence", 0.0))
    danger_level: str = result.get("danger_level", "low")

    alert = None
    broadcast = False

    if fall_detected and should_accept_fall_report(confidence, danger_level):
        location = f" in {room_name}" if room_name else ""
        message = build_fall_message(
            confidence,
            danger_level,
            result.get("coordinates"),
            f"AI-detected fall{location}",
        )
        alert = state_service.create_fall_alert(message, patient_id=patient_id)
        await events.alert(alert)
        broadcast = True

    return ClipFallAnalysisResponse(
        fall_detected=fall_detected,
        confidence=confidence,
        danger_level=danger_level,
        coordinates=result.get("coordinates"),
        frame_timestamp=result.get("frame_timestamp"),
        alert=alert,
        broadcast=broadcast,
    )
