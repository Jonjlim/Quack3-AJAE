from datetime import timedelta

from fastapi import APIRouter, HTTPException
from livekit import api

from app.config import settings
from shared.schemas.telemetry import LiveKitTokenRequest, LiveKitTokenResponse

router = APIRouter(prefix="/api/v1", tags=["livekit"])


@router.post("/livekit/token", response_model=LiveKitTokenResponse)
async def create_livekit_token(body: LiveKitTokenRequest) -> LiveKitTokenResponse:
    if not settings.livekit_api_key or not settings.livekit_api_secret:
        raise HTTPException(status_code=503, detail="LiveKit not configured")

    grant = api.VideoGrants(
        room_join=True,
        room=body.room,
        can_publish=body.role.value in ("patient", "broad_camera"),
        can_subscribe=True,
    )
    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(body.identity)
        .with_name(body.identity)
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
