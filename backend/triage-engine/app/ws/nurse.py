import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.events import EventBus
from app.services.state import state_service
from app.ws.manager import manager
from shared.schemas.telemetry import (
    AlertEvent,
    BiometricReading,
    CameraStatusPayload,
    HelpRequestPayload,
    TelemetryEnvelope,
    TelemetryEventType,
)

router = APIRouter(tags=["websockets"])
events = EventBus(manager, state_service)


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
                    patient = state_service.get_patient(help_payload.patient_id)
                    await events.alert(alert)
                    if patient:
                        await events.patient_update(patient)
                    await events.help_ack(help_payload.patient_id)
                    await manager.send_json(
                        websocket,
                        {"status": "received", "alert_id": alert.alert_id},
                    )
                elif envelope.type == TelemetryEventType.CAMERA_STATUS:
                    camera_payload = CameraStatusPayload.model_validate(envelope.payload)
                    patient = state_service.set_camera_enabled(
                        camera_payload.patient_id,
                        camera_payload.enabled,
                    )
                    if patient:
                        await events.patient_update(patient)
                    await manager.send_json(websocket, {"status": "received"})
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
                    await events.alert(alert)
                    if alert.patient_id:
                        patient = state_service.get_patient(alert.patient_id)
                        if patient:
                            await events.patient_update(patient)
                elif envelope.type == TelemetryEventType.BIOMETRIC:
                    reading = BiometricReading.model_validate(envelope.payload)
                    patient, bio_alert = state_service.apply_biometric(reading)
                    await events.biometric(reading)
                    if patient:
                        await events.patient_update(patient)
                    if bio_alert:
                        await events.alert(bio_alert)
                await manager.send_json(websocket, {"status": "received"})
            except Exception:
                await manager.send_json(websocket, {"status": "error", "detail": "Invalid payload"})
    except WebSocketDisconnect:
        manager.disconnect("ai", websocket)


async def wait_time_ticker(interval_seconds: int = 30) -> None:
    """Background loop — refresh wait times and push queue updates to connected clients."""
    while True:
        await asyncio.sleep(interval_seconds)
        positions_changed = state_service.refresh_wait_times()
        await events.patients_snapshot()
        if positions_changed:
            for patient in state_service.get_patients():
                await events.queue_update(patient.patient_id)
