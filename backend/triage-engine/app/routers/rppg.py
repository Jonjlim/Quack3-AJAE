import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.events import EventBus
from app.services.rppg_bridge import RppgUnavailableError, run_rppg_analysis
from app.services.state import state_service
from app.ws.manager import manager
from shared.schemas.telemetry import (
    BiometricReading,
    RppgAnalysisResult,
    SceneIntelRppgResponse,
)

router = APIRouter(prefix="/api/v1", tags=["rppg"])
events = EventBus(manager, state_service)


@router.post("/rppg", response_model=SceneIntelRppgResponse)
async def analyze_rppg(
    patient_id: str = Form(...),
    video: UploadFile = File(...),
) -> SceneIntelRppgResponse:
    """Run rPPG heart-rate analysis on a patient video clip."""
    patient = state_service.get_patient(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not patient.camera_enabled:
        patient = state_service.set_camera_enabled(patient_id, True)
        if patient:
            await events.patient_update(patient)

    if not video.content_type or not video.content_type.startswith("video/"):
        raise HTTPException(status_code=415, detail="Upload must be a video file")

    video_bytes = await video.read()
    if not video_bytes:
        raise HTTPException(status_code=400, detail="Empty video upload")

    try:
        raw = await asyncio.to_thread(run_rppg_analysis, video_bytes)
    except RppgUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    analysis = RppgAnalysisResult.model_validate(raw)
    biometric = None
    alert = None
    broadcast = False

    should_broadcast = (
        analysis.heart_rate_bpm is not None
        and analysis.measurement_status != "unreliable"
        and analysis.confidence >= 0.5
    )

    if should_broadcast:
        reading = BiometricReading(
            patient_id=patient_id,
            heart_rate_bpm=analysis.heart_rate_bpm,
            heart_rate_bpm_low=analysis.heart_rate_bpm_low,
            heart_rate_bpm_high=analysis.heart_rate_bpm_high,
            respiratory_rate_bpm=None,
            confidence=analysis.confidence,
            measurement_status=analysis.measurement_status,
            source="rppg",
            recorded_at=datetime.now(timezone.utc),
        )
        patient, bio_alert = state_service.apply_biometric(reading)
        biometric = patient.last_biometric if patient else reading
        broadcast = True
        await events.biometric(biometric)
        if patient:
            await events.patient_update(patient)
        if bio_alert:
            alert = bio_alert
            await events.alert(bio_alert)

    return SceneIntelRppgResponse(
        analysis=analysis,
        biometric=biometric,
        alert=alert,
        broadcast=broadcast,
    )
