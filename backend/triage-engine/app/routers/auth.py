from fastapi import APIRouter, Depends, HTTPException

from app.deps.auth import require_firebase_user
from app.firebase_app import FirebaseUser, set_user_claims
from app.services.state import state_service
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LinkPatientRequest(BaseModel):
    patient_id: str = Field(min_length=1)


class LinkPatientResponse(BaseModel):
    patient_id: str
    linked: bool = True


class RegisterNurseResponse(BaseModel):
    role: str = "nurse"
    uid: str


@router.post("/register-nurse", response_model=RegisterNurseResponse)
async def register_nurse(
    user: FirebaseUser = Depends(require_firebase_user),
) -> RegisterNurseResponse:
    """Assign nurse custom claims after Google Sign-In."""
    set_user_claims(user.uid, {"role": "nurse"})
    return RegisterNurseResponse(role="nurse", uid=user.uid)


@router.post("/link-patient", response_model=LinkPatientResponse)
async def link_patient(
    body: LinkPatientRequest,
    user: FirebaseUser = Depends(require_firebase_user),
) -> LinkPatientResponse:
    """Bind anonymous Firebase session to a nurse-issued patient_id."""
    patient_id = body.patient_id.strip()
    if state_service.get_patient(patient_id) is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    set_user_claims(user.uid, {"role": "patient", "patient_id": patient_id})
    return LinkPatientResponse(patient_id=patient_id)
