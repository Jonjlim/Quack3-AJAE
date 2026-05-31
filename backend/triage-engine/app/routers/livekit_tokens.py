from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from livekit import api

from app.config import settings
from app.deps.auth import assert_patient_match, require_firebase_user
from app.firebase_app import FirebaseUser, firebase_auth_enabled
from shared.schemas.telemetry import LiveKitRole, LiveKitTokenRequest, LiveKitTokenResponse

router = APIRouter(prefix="/api/v1", tags=["livekit"])


@router.post("/livekit/token", response_model=LiveKitTokenResponse)
async def create_livekit_token(
    body: LiveKitTokenRequest,
    user: FirebaseUser = Depends(require_firebase_user),
) -> LiveKitTokenResponse:
    if firebase_auth_enabled():
        if body.role == LiveKitRole.PATIENT:
            assert_patient_match(user, body.identity)
        elif user.role != "nurse":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Nurse role required",
            )
    if not settings.livekit_is_configured():
        raise HTTPException(
            status_code=503,
            detail="LiveKit not configured — set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL on the server",
        )

    grant = api.VideoGrants(
        room_join=True,
        room=body.room,
        can_publish=body.role.value in ("patient", "broad_camera"),
        can_subscribe=True,
    )
    participant_name = (body.display_name or "").strip() or body.identity
    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(body.identity)
        .with_name(participant_name)
        .with_grants(grant)
        .with_ttl(timedelta(hours=6))
        .to_jwt()
    )

    return LiveKitTokenResponse(
        token=token,
        url=settings.livekit_url,
        room=body.room,
        identity=body.identity,
    )
