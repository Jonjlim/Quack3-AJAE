from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.services.events import EventBus
from app.services.state import state_service
from app.ws.manager import manager
from app.services.fall_alerts import build_fall_message, should_accept_fall_report
from shared.schemas.telemetry import (
    AcuityLoad,
    AlertAckRequest,
    AlertAckResponse,
    BrowserFallReportRequest,
    CameraStatusPayload,
    DemoFallTriggerResponse,
    FallReportResponse,
    PatientRecord,
    QueueStatus,
)

router = APIRouter(prefix="/api/v1", tags=["queue"])
events = EventBus(manager, state_service)


@router.get("/queue/{patient_id}", response_model=QueueStatus)
async def get_queue_status(patient_id: str) -> QueueStatus:
    queue = state_service.get_queue_status(patient_id)
    if queue is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return queue


@router.get("/acuity-load", response_model=AcuityLoad)
async def get_acuity_load() -> AcuityLoad:
    return state_service.acuity_load


@router.get("/patients", response_model=list[PatientRecord])
async def get_patients() -> list[PatientRecord]:
    return state_service.get_patients()


@router.post("/patients/{patient_id}/camera", response_model=PatientRecord)
async def set_patient_camera(patient_id: str, body: CameraStatusPayload) -> PatientRecord:
    """Reliable camera opt-in before rPPG sampling (WebSocket can race the first clip)."""
    if body.patient_id != patient_id:
        raise HTTPException(status_code=400, detail="patient_id in body must match URL")
    patient = state_service.get_patient(patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    updated = state_service.set_camera_enabled(patient_id, body.enabled)
    if updated is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    await events.patient_update(updated)
    return updated


@router.post("/alerts/{alert_id}/ack", response_model=AlertAckResponse)
async def acknowledge_alert(alert_id: str, body: AlertAckRequest) -> AlertAckResponse:
    alert = state_service.acknowledge_alert(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    acknowledged_at = datetime.now(timezone.utc)
    return AlertAckResponse(
        alert_id=alert_id,
        acknowledged=True,
        acknowledged_at=acknowledged_at,
    )


@router.post("/alerts/fall-report", response_model=FallReportResponse)
async def report_browser_fall(body: BrowserFallReportRequest) -> FallReportResponse:
    """Ingest a fall detected in the browser and broadcast CRITICAL_FALL to nurses."""
    if not should_accept_fall_report(body.confidence, body.danger_level):
        raise HTTPException(
            status_code=422,
            detail="Fall report below confidence/danger threshold",
        )

    message = build_fall_message(
        body.confidence,
        body.danger_level,
        body.coordinates,
        body.message,
    )
    alert = state_service.create_fall_alert(message, patient_id=body.patient_id)
    await events.alert(alert)
    return FallReportResponse(alert=alert, broadcast=True, accepted=True)


@router.post("/demo/trigger-fall", response_model=DemoFallTriggerResponse)
async def trigger_demo_fall() -> DemoFallTriggerResponse:
    alert = state_service.create_demo_fall_alert()
    await events.alert(alert)
    return DemoFallTriggerResponse(alert=alert, broadcast=True)
