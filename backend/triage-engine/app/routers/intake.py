import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status

from app.deps.auth import require_nurse
from app.firebase_app import FirebaseUser
from app.services.events import EventBus
from app.services.gemini_triage import suggest_acuity
from app.services.state import state_service
from app.ws.manager import manager
from shared.schemas.telemetry import (
    AcuityLevel,
    IntakeRequest,
    IntakeResponse,
    PatientRecord,
    PatientStatus,
)

router = APIRouter(prefix="/api/v1", tags=["intake"])
events = EventBus(manager, state_service)


@router.post("/intake", response_model=IntakeResponse, status_code=status.HTTP_201_CREATED)
async def create_intake(
    body: IntakeRequest,
    _nurse: FirebaseUser = Depends(require_nurse),
) -> IntakeResponse:
    patient_id = f"pat-{uuid.uuid4().hex[:6]}"
    now = datetime.now(timezone.utc)

    # Gemini provides a clinical observation note only — acuity is set by the human nurse.
    gemini = suggest_acuity(body.chief_complaint)
    triage_reasoning = gemini.get("analysis") or None

    # Acuity defaults to URGENT until a nurse overrides it at the bedside.
    acuity = body.acuity_self_report or AcuityLevel.URGENT

    patient = PatientRecord(
        patient_id=patient_id,
        display_name=body.display_name,
        queue_position=1,
        acuity=acuity,
        status=PatientStatus.WAITING,
        wait_minutes=0,
        chief_complaint=body.chief_complaint,
        triage_reasoning=triage_reasoning,
        camera_enabled=False,
        last_biometric=None,
        created_at=now,
    )
    added = state_service.add_patient(patient)
    queue = state_service.get_queue_status(patient_id)

    await events.patients_snapshot()
    if added:
        await events.patient_update(added)

    return IntakeResponse(
        patient_id=patient_id,
        queue_position=added.queue_position if added else 1,
        estimated_wait_minutes=queue.estimated_wait_minutes if queue else state_service.acuity_load.estimated_wait_minutes,
        created_at=now,
    )
