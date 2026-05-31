"""Room-camera fall detection via Gemini 4-frame sequence analysis.

Endpoint: POST /api/v1/alerts/analyze-snapshot

The frontend sends one JPEG snapshot per second from the room camera.
This endpoint maintains a per-room rolling buffer (snapshot_store) and,
once 10 seconds of history have accumulated, passes four frames evenly
spaced across the last 9 seconds to Gemini:

    Frame 1 — 9 s ago  (oldest)
    Frame 2 — 6 s ago
    Frame 3 — 3 s ago
    Frame 4 — NOW

Gemini reasons about the full trajectory of movement across the 9-second
window rather than a single before/after snapshot pair — dramatically
improving detection of slow collapses, chair slumps, and gradual faints.

On a confirmed fall a CRITICAL_FALL alert is broadcast to all nurse
WebSocket clients.  Alerts are rate-limited per room to prevent duplicate
broadcasts while a victim remains on the ground.
"""

import asyncio
import time
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.deps.auth import require_firebase_user
from app.firebase_app import FirebaseUser
from app.services.events import EventBus
from app.services.fall_alerts import build_fall_message, should_accept_fall_report
from app.services.scene_fall_bridge import SceneFallUnavailableError, run_sequence_analysis
from app.services.snapshot_store import snapshot_store
from app.services.state import state_service
from app.ws.manager import manager
from shared.schemas.telemetry import SnapshotFallAnalysisResponse

router = APIRouter(prefix="/api/v1", tags=["scene-fall"])
events = EventBus(manager, state_service)

# Per-room alert cooldown — prevents spamming while a victim stays on the ground
_ALERT_COOLDOWN_S: float = 12.0
_last_alert_at: dict[str, float] = {}


def _can_broadcast_alert(room_key: str) -> bool:
    now = time.monotonic()
    if now - _last_alert_at.get(room_key, 0.0) >= _ALERT_COOLDOWN_S:
        _last_alert_at[room_key] = now
        return True
    return False


@router.post("/alerts/analyze-snapshot", response_model=SnapshotFallAnalysisResponse)
async def analyze_snapshot(
    snapshot: Annotated[UploadFile, File(description="JPEG camera snapshot (~960 px wide)")],
    room_name: Annotated[str | None, Form()] = None,
    patient_id: Annotated[str | None, Form()] = None,
    mime_type: Annotated[str, Form()] = "image/jpeg",
    _user: FirebaseUser = Depends(require_firebase_user),
) -> SnapshotFallAnalysisResponse:
    """Receive one camera frame; when 10 s of history exist, run Gemini sequence analysis.

    • First ~10 calls per room: snapshot is buffered, returns fall_detected=false.
    • From the 11th call onwards: Gemini receives 4 frames spanning 9 seconds and
      returns a structured fall-detection result.
    • On a confirmed fall a CRITICAL_FALL alert is broadcast to nurses via WebSocket
      (rate-limited to once per 12 seconds per room).
    """
    image_bytes = await snapshot.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty snapshot")

    room_key = (room_name or "default").strip()

    # Push into the rolling buffer; get 4-frame sequence or None if still warming up
    frames = snapshot_store.push(room_key, image_bytes, mime_type)

    if frames is None:
        return SnapshotFallAnalysisResponse(
            fall_detected=False,
            confidence=0.0,
            danger_level="low",
            coordinates=None,
            description="Buffering — waiting for 10 seconds of history.",
            alert=None,
            broadcast=False,
        )

    # Build (bytes, mime_type) tuples for the bridge — oldest frame first
    frame_pairs = [(f.image_bytes, f.mime_type) for f in frames]

    try:
        result = await asyncio.to_thread(run_sequence_analysis, frame_pairs)
    except SceneFallUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    fall_detected: bool = bool(result.get("fall_detected", False))
    confidence: float = float(result.get("confidence", 0.0))
    danger_level: str = result.get("danger_level", "low")

    alert = None
    broadcast = False

    if (
        fall_detected
        and should_accept_fall_report(confidence, danger_level)
        and _can_broadcast_alert(room_key)
    ):
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

    return SnapshotFallAnalysisResponse(
        fall_detected=fall_detected,
        confidence=confidence,
        danger_level=danger_level,
        coordinates=result.get("coordinates"),
        description=result.get("description"),
        alert=alert,
        broadcast=broadcast,
    )
