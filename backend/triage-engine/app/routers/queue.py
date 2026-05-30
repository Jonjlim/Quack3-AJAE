from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from app.services.state import state_service
from app.ws.manager import manager
from shared.schemas.telemetry import (
    AcuityLoad,
    AlertAckRequest,
    AlertAckResponse,
    DemoFallTriggerResponse,
    PatientRecord,
    QueueStatus,
    TelemetryEventType,
)

router = APIRouter(prefix="/api/v1", tags=["queue"])


@router.get("/queue/{patient_id}", response_model=QueueStatus)
async def get_queue_status(patient_id: str) -> QueueStatus:
    status = state_service.get_queue_status(patient_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return status


@router.get("/acuity-load", response_model=AcuityLoad)
async def get_acuity_load() -> AcuityLoad:
    return state_service.acuity_load


@router.get("/patients", response_model=list[PatientRecord])
async def get_patients() -> list[PatientRecord]:
    return state_service.get_patients()


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


@router.post("/demo/trigger-fall", response_model=DemoFallTriggerResponse)
async def trigger_demo_fall() -> DemoFallTriggerResponse:
    alert = state_service.create_demo_fall_alert()
    await manager.broadcast(
        "nurse",
        TelemetryEventType.ALERT,
        alert.model_dump(mode="json"),
    )
    return DemoFallTriggerResponse(alert=alert, broadcast=True)
