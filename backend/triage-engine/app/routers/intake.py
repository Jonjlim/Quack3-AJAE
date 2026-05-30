import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from app.services.state import state_service
from shared.schemas.telemetry import (
    AcuityLevel,
    IntakeRequest,
    IntakeResponse,
    PatientRecord,
    PatientStatus,
)

router = APIRouter(prefix="/api/v1", tags=["intake"])


@router.post("/intake", response_model=IntakeResponse, status_code=status.HTTP_201_CREATED)
async def create_intake(body: IntakeRequest) -> IntakeResponse:
    patient_id = f"pat-{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc)
    position = len(state_service.patients) + 1

    patient = PatientRecord(
        patient_id=patient_id,
        display_name=body.display_name,
        queue_position=position,
        acuity=body.acuity_self_report or AcuityLevel.URGENT,
        status=PatientStatus.WAITING,
        wait_minutes=0,
        chief_complaint=body.chief_complaint,
        camera_enabled=False,
        last_biometric=None,
        created_at=now,
    )
    state_service.add_patient(patient)

    return IntakeResponse(
        patient_id=patient_id,
        queue_position=position,
        estimated_wait_minutes=state_service.acuity_load.estimated_wait_minutes,
        created_at=now,
    )
