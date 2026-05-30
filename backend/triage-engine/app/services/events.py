"""WebSocket broadcast helpers — call after every state mutation."""

from app.services.state import StateService
from app.ws.manager import ConnectionManager
from shared.schemas.telemetry import (
    AlertEvent,
    BiometricReading,
    PatientRecord,
    TelemetryEventType,
)


class EventBus:
    def __init__(self, manager: ConnectionManager, state: StateService) -> None:
        self._manager = manager
        self._state = state

    async def patients_snapshot(self) -> None:
        patients = self._state.get_patients()
        await self._manager.broadcast(
            "nurse",
            TelemetryEventType.PATIENTS_SNAPSHOT,
            {"patients": [p.model_dump(mode="json") for p in patients]},
        )

    async def patient_update(self, patient: PatientRecord) -> None:
        await self._manager.broadcast(
            "nurse",
            TelemetryEventType.PATIENT_UPDATE,
            patient.model_dump(mode="json"),
        )
        await self.queue_update(patient.patient_id)

    async def queue_update(self, patient_id: str) -> None:
        queue = self._state.get_queue_status(patient_id)
        if queue is None:
            return
        await self._manager.broadcast(
            f"patient:{patient_id}",
            TelemetryEventType.QUEUE_UPDATE,
            queue.model_dump(mode="json"),
        )

    async def alert(self, event: AlertEvent) -> None:
        await self._manager.broadcast(
            "nurse",
            TelemetryEventType.ALERT,
            event.model_dump(mode="json"),
        )

    async def biometric(self, reading: BiometricReading) -> None:
        await self._manager.broadcast(
            "nurse",
            TelemetryEventType.BIOMETRIC,
            reading.model_dump(mode="json"),
        )

    async def help_ack(self, patient_id: str, message: str = "Help request received — nurse en route") -> None:
        await self._manager.broadcast(
            f"patient:{patient_id}",
            TelemetryEventType.HELP_ACK,
            {"patient_id": patient_id, "message": message},
        )
