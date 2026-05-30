from datetime import datetime, timezone

from app.mock_data import MOCK_ACUITY_LOAD, MOCK_ALERTS, MOCK_PATIENTS
from app.services.triage import sort_patients
from shared.schemas.telemetry import (
    AcuityLoad,
    AlertEvent,
    AlertSeverity,
    AlertType,
    PatientRecord,
    PatientStatus,
    QueueStatus,
)


class StateService:
    """In-memory live state stub — swap for Redis-backed persistence later."""

    def __init__(self) -> None:
        self.patients: list[PatientRecord] = list(MOCK_PATIENTS)
        self.alerts: list[AlertEvent] = list(MOCK_ALERTS)
        self.acuity_load: AcuityLoad = MOCK_ACUITY_LOAD

    def get_patients(self) -> list[PatientRecord]:
        return sort_patients(self.patients)

    def get_patient(self, patient_id: str) -> PatientRecord | None:
        for patient in self.patients:
            if patient.patient_id == patient_id:
                return patient
        return None

    def add_patient(self, patient: PatientRecord) -> PatientRecord:
        self.patients.append(patient)
        self.acuity_load.total_waiting = len(self.patients)
        self.acuity_load.updated_at = datetime.now(timezone.utc)
        return patient

    def get_queue_status(self, patient_id: str) -> QueueStatus | None:
        patient = self.get_patient(patient_id)
        if patient is None:
            return None
        return QueueStatus(
            patient_id=patient.patient_id,
            queue_position=patient.queue_position,
            wait_minutes=patient.wait_minutes,
            estimated_wait_minutes=self.acuity_load.estimated_wait_minutes,
            status=patient.status,
            acuity_load=self.acuity_load,
        )

    def add_alert(self, alert: AlertEvent) -> AlertEvent:
        self.alerts.append(alert)
        return alert

    def acknowledge_alert(self, alert_id: str) -> AlertEvent | None:
        for alert in self.alerts:
            if alert.alert_id == alert_id:
                alert.acknowledged = True
                return alert
        return None

    def create_help_alert(self, patient_id: str, message: str) -> AlertEvent:
        alert = AlertEvent(
            alert_id=f"alert-help-{patient_id}-{int(datetime.now(timezone.utc).timestamp())}",
            type=AlertType.HELP_REQUEST,
            severity=AlertSeverity.CRITICAL,
            patient_id=patient_id,
            message=message,
            acknowledged=False,
            created_at=datetime.now(timezone.utc),
        )
        return self.add_alert(alert)

    def create_demo_fall_alert(self) -> AlertEvent:
        alert = AlertEvent(
            alert_id=f"alert-demo-fall-{int(datetime.now(timezone.utc).timestamp())}",
            type=AlertType.CRITICAL_FALL,
            severity=AlertSeverity.CRITICAL,
            patient_id=None,
            message="Fall detected in waiting room sector B",
            acknowledged=False,
            created_at=datetime.now(timezone.utc),
        )
        return self.add_alert(alert)


state_service = StateService()
