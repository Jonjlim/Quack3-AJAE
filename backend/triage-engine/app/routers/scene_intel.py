import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.events import EventBus
from app.services.scene_intel_bridge import (
    SceneIntelUnavailableError,
    run_fall_detection,
    run_rppg_analysis,
    should_fire_fall_alert,
)
from app.services.state import state_service
from app.ws.manager import manager
from shared.schemas.telemetry import (
    BiometricReading,
    FallDetectionResult,
    RppgAnalysisResult,
    SceneIntelFallResponse,
    SceneIntelRppgResponse,
)

router = APIRouter(prefix="/api/v1/scene-intel", tags=["scene-intel"])
events = EventBus(manager, state_service)


def _build_fall_message(result: FallDetectionResult) -> str:
    base = f"Fall detected (confidence {result.confidence:.0%}, danger {result.danger_level})"
    if result.coordinates:
        return f"{base} at coordinates ({result.coordinates.get('x')}, {result.coordinates.get('y')})"
    return base


@router.post("/fall-detection", response_model=SceneIntelFallResponse)
async def analyze_fall(video: UploadFile = File(...)) -> SceneIntelFallResponse:
    """Run scene-intel fall detection on an uploaded video clip."""
    if not video.content_type or not video.content_type.startswith("video/"):
        raise HTTPException(status_code=415, detail="Upload must be a video file")

    video_bytes = await video.read()
    if not video_bytes:
        raise HTTPException(status_code=400, detail="Empty video upload")

    try:
        raw = await asyncio.to_thread(run_fall_detection, video_bytes)
    except SceneIntelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    analysis = FallDetectionResult.model_validate(raw)
    alert = None
    broadcast = False

    if should_fire_fall_alert(raw):
        alert = state_service.create_fall_alert(_build_fall_message(analysis))
        await events.alert(alert)
        broadcast = True

    return SceneIntelFallResponse(analysis=analysis, alert=alert, broadcast=broadcast)


@router.post("/rppg", response_model=SceneIntelRppgResponse)
async def analyze_rppg(
    patient_id: str = Form(...),
    video: UploadFile = File(...),
) -> SceneIntelRppgResponse:
    """Run scene-intel rPPG heart-rate analysis and apply biometrics to a patient."""
    if state_service.get_patient(patient_id) is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not video.content_type or not video.content_type.startswith("video/"):
        raise HTTPException(status_code=415, detail="Upload must be a video file")

    video_bytes = await video.read()
    if not video_bytes:
        raise HTTPException(status_code=400, detail="Empty video upload")

    try:
        raw = await asyncio.to_thread(run_rppg_analysis, video_bytes)
    except SceneIntelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    analysis = RppgAnalysisResult.model_validate(raw)
    biometric = None
    alert = None
    broadcast = False

    if analysis.heart_rate_bpm is not None:
        reading = BiometricReading(
            patient_id=patient_id,
            heart_rate_bpm=analysis.heart_rate_bpm,
            respiratory_rate_bpm=None,
            confidence=analysis.confidence,
            source="rppg",
            recorded_at=datetime.now(timezone.utc),
        )
        patient, bio_alert = state_service.apply_biometric(reading)
        biometric = reading
        broadcast = True
        await events.biometric(reading)
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
