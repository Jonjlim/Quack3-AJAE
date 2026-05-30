import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.state import state_service
from app.ws.manager import manager
from shared.schemas.telemetry import (
    AlertEvent,
    BiometricReading,
    HelpRequestPayload,
    TelemetryEnvelope,
    TelemetryEventType,
)

router = APIRouter(tags=["websockets"])


@router.websocket("/ws/nurse")
async def nurse_websocket(websocket: WebSocket) -> None:
    await manager.connect("nurse", websocket)
    try:
        patients = state_service.get_patients()
        await websocket.send_text(
            TelemetryEnvelope(
                type=TelemetryEventType.PATIENTS_SNAPSHOT,
                timestamp=datetime.now(timezone.utc),
                payload={"patients": [p.model_dump(mode="json") for p in patients]},
            ).model_dump_json()
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect("nurse", websocket)


@router.websocket("/ws/patient/{patient_id}")
async def patient_websocket(websocket: WebSocket, patient_id: str) -> None:
    group = f"patient:{patient_id}"
    await manager.connect(group, websocket)
    try:
        queue = state_service.get_queue_status(patient_id)
        if queue:
            await websocket.send_text(
                TelemetryEnvelope(
                    type=TelemetryEventType.QUEUE_UPDATE,
                    timestamp=datetime.now(timezone.utc),
                    payload=queue.model_dump(mode="json"),
                ).model_dump_json()
            )
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                envelope = TelemetryEnvelope.model_validate(data)
                if envelope.type == TelemetryEventType.ALERT:
                    help_payload = HelpRequestPayload.model_validate(envelope.payload)
                    alert = state_service.create_help_alert(
                        help_payload.patient_id,
                        help_payload.message,
                    )
                    await manager.broadcast(
                        "nurse",
                        TelemetryEventType.ALERT,
                        alert.model_dump(mode="json"),
                    )
                    await manager.send_json(
                        websocket,
                        {"status": "received", "alert_id": alert.alert_id},
                    )
            except Exception:
                await manager.send_json(websocket, {"status": "error", "detail": "Invalid payload"})
    except WebSocketDisconnect:
        manager.disconnect(group, websocket)


@router.websocket("/ws/ai")
async def ai_websocket(websocket: WebSocket) -> None:
    await manager.connect("ai", websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
                envelope = TelemetryEnvelope.model_validate(data)
                if envelope.type == TelemetryEventType.ALERT:
                    alert = AlertEvent.model_validate(envelope.payload)
                    state_service.add_alert(alert)
                    await manager.broadcast(
                        "nurse",
                        TelemetryEventType.ALERT,
                        alert.model_dump(mode="json"),
                    )
                elif envelope.type == TelemetryEventType.BIOMETRIC:
                    reading = BiometricReading.model_validate(envelope.payload)
                    await manager.broadcast(
                        "nurse",
                        TelemetryEventType.BIOMETRIC,
                        reading.model_dump(mode="json"),
                    )
                await manager.send_json(websocket, {"status": "received"})
            except Exception:
                await manager.send_json(websocket, {"status": "error", "detail": "Invalid payload"})
    except WebSocketDisconnect:
        manager.disconnect("ai", websocket)
