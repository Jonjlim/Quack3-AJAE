from datetime import datetime, timezone

from app.services.triage import (
    assign_queue_positions,
    bump_acuity,
    compute_acuity_load,
    estimate_wait_minutes,
    is_biometric_critical,
    wait_minutes_since,
)
from shared.schemas.telemetry import (
    AcuityLoad,
    AlertEvent,
    AlertSeverity,
    AlertType,
    BiometricReading,
    PatientRecord,
    PatientStatus,
    QueueStatus,
)


class StateService:
    """Live triage state — in-memory with full queue recomputation on every mutation."""

    def __init__(self, seed_patients: list[PatientRecord] | None = None) -> None:
        self.patients: list[PatientRecord] = list(seed_patients or [])
        self.alerts: list[AlertEvent] = []
        self.acuity_load: AcuityLoad = compute_acuity_load(self.patients)
        if self.patients:
            self._recompute()

    def _recompute(self) -> None:
        now = datetime.now(timezone.utc)
        refreshed = [
            p.model_copy(update={"wait_minutes": wait_minutes_since(p.created_at, now)})
            for p in self.patients
        ]
        self.patients = assign_queue_positions(refreshed)
        self.acuity_load = compute_acuity_load(self.patients, now)

    def refresh_wait_times(self) -> bool:
        """Recompute wait times and queue order. Returns True if positions changed."""
        before = {p.patient_id: p.queue_position for p in self.patients}
        self._recompute()
        after = {p.patient_id: p.queue_position for p in self.patients}
        return before != after

    def get_patients(self) -> list[PatientRecord]:
        return list(self.patients)

    def get_patient(self, patient_id: str) -> PatientRecord | None:
        for patient in self.patients:
            if patient.patient_id == patient_id:
                return patient
        return None

    def add_patient(self, patient: PatientRecord) -> PatientRecord:
        self.patients.append(patient)
        self._recompute()
        return self.get_patient(patient.patient_id) or patient

    def get_queue_status(self, patient_id: str) -> QueueStatus | None:
        patient = self.get_patient(patient_id)
        if patient is None:
            return None
        sorted_patients = self.get_patients()
        return QueueStatus(
            patient_id=patient.patient_id,
            queue_position=patient.queue_position,
            wait_minutes=patient.wait_minutes,
            estimated_wait_minutes=estimate_wait_minutes(sorted_patients, patient_id),
            status=patient.status,
            acuity_load=self.acuity_load,
        )

    def escalate_patient(self, patient_id: str) -> PatientRecord | None:
        patient = self.get_patient(patient_id)
        if patient is None:
            return None
        updated = patient.model_copy(
            update={
                "status": PatientStatus.ESCALATED,
                "acuity": bump_acuity(patient.acuity),
            }
        )
        self._replace_patient(updated)
        return self.get_patient(patient_id)

    def set_camera_enabled(self, patient_id: str, enabled: bool) -> PatientRecord | None:
        patient = self.get_patient(patient_id)
        if patient is None:
            return None
        updated = patient.model_copy(
            update={
                "camera_enabled": enabled,
                "status": PatientStatus.STREAMING if enabled else PatientStatus.WAITING,
            }
        )
        self._replace_patient(updated)
        return self.get_patient(patient_id)

    def apply_biometric(self, reading: BiometricReading) -> tuple[PatientRecord | None, AlertEvent | None]:
        patient = self.get_patient(reading.patient_id)
        if patient is None:
            return None, None

        previous = patient.last_biometric
        updated = patient.model_copy(update={"last_biometric": reading})
        self._replace_patient(updated)

        alert: AlertEvent | None = None
        if is_biometric_critical(reading, previous):
            self.escalate_patient(reading.patient_id)
            alert = AlertEvent(
                alert_id=f"alert-bio-{reading.patient_id}-{int(datetime.now(timezone.utc).timestamp())}",
                type=AlertType.BIOMETRIC_DROP,
                severity=AlertSeverity.CRITICAL,
                patient_id=reading.patient_id,
                message=f"Critical biometric drop detected (HR {reading.heart_rate_bpm} bpm)",
                acknowledged=False,
                created_at=datetime.now(timezone.utc),
            )
            self.alerts.append(alert)

        return self.get_patient(reading.patient_id), alert

    def _replace_patient(self, updated: PatientRecord) -> None:
        self.patients = [updated if p.patient_id == updated.patient_id else p for p in self.patients]
        self._recompute()

    def add_alert(self, alert: AlertEvent) -> AlertEvent:
        self.alerts.append(alert)
        if alert.patient_id:
            self.escalate_patient(alert.patient_id)
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


from app.mock_data import MOCK_PATIENTS

state_service = StateService(seed_patients=MOCK_PATIENTS)
