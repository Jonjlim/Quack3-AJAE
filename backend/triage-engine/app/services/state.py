from datetime import datetime, timezone

from app.services.triage import (
    assign_queue_positions,
    bump_acuity,
    compute_acuity_load,
    estimate_wait_minutes,
    format_hr_alert_message,
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

    _HR_BUFFER_SIZE = 8
    _HR_EMA_ALPHA = 0.28
    _MAX_HR_STEP_BPM = 15
    _MIN_SAMPLES_FOR_ALERT = 4
    _ALERT_COOLDOWN_SECONDS = 120

    def __init__(self, seed_patients: list[PatientRecord] | None = None) -> None:
        self.patients: list[PatientRecord] = list(seed_patients or [])
        self.alerts: list[AlertEvent] = []
        self.acuity_load: AcuityLoad = compute_acuity_load(self.patients)
        self._hr_buffer: dict[str, list[float]] = {}
        self._hr_ema: dict[str, float] = {}
        self._last_bio_alert_at: dict[str, datetime] = {}
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

    def _smooth_hr(self, patient_id: str, hr: float) -> float:
        """EMA with per-sample spike damping — keeps demo vitals stable under noisy rPPG."""
        ema = self._hr_ema.get(patient_id)
        if ema is None:
            self._hr_ema[patient_id] = hr
            self._hr_buffer.setdefault(patient_id, []).append(hr)
            return hr

        delta = hr - ema
        if abs(delta) > self._MAX_HR_STEP_BPM:
            hr = ema + (self._MAX_HR_STEP_BPM if delta > 0 else -self._MAX_HR_STEP_BPM)

        ema = self._HR_EMA_ALPHA * hr + (1 - self._HR_EMA_ALPHA) * ema
        self._hr_ema[patient_id] = ema

        buffer = self._hr_buffer.setdefault(patient_id, [])
        buffer.append(ema)
        if len(buffer) > self._HR_BUFFER_SIZE:
            buffer.pop(0)

        return round(ema, 1)

    def _can_raise_bio_alert(self, patient_id: str) -> bool:
        if len(self._hr_buffer.get(patient_id, [])) < self._MIN_SAMPLES_FOR_ALERT:
            return False
        last_alert = self._last_bio_alert_at.get(patient_id)
        if last_alert is None:
            return True
        elapsed = (datetime.now(timezone.utc) - last_alert).total_seconds()
        return elapsed >= self._ALERT_COOLDOWN_SECONDS

    def apply_biometric(self, reading: BiometricReading) -> tuple[PatientRecord | None, AlertEvent | None]:
        patient = self.get_patient(reading.patient_id)
        if patient is None:
            return None, None

        smoothed = reading
        if reading.heart_rate_bpm is not None:
            smooth_hr = self._smooth_hr(reading.patient_id, reading.heart_rate_bpm)
            smoothed = reading.model_copy(update={"heart_rate_bpm": round(smooth_hr, 1)})

        previous = patient.last_biometric
        updated = patient.model_copy(update={"last_biometric": smoothed})
        self._replace_patient(updated)

        alert: AlertEvent | None = None
        if self._can_raise_bio_alert(reading.patient_id) and is_biometric_critical(smoothed, previous):
            self.escalate_patient(reading.patient_id)
            alert = AlertEvent(
                alert_id=f"alert-bio-{reading.patient_id}-{int(datetime.now(timezone.utc).timestamp())}",
                type=AlertType.BIOMETRIC_DROP,
                severity=AlertSeverity.CRITICAL,
                patient_id=reading.patient_id,
                message=format_hr_alert_message(smoothed),
                acknowledged=False,
                created_at=datetime.now(timezone.utc),
            )
            self.alerts.append(alert)
            self._last_bio_alert_at[reading.patient_id] = alert.created_at

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

    def create_fall_alert(self, message: str, patient_id: str | None = None) -> AlertEvent:
        alert = AlertEvent(
            alert_id=f"alert-fall-{int(datetime.now(timezone.utc).timestamp())}",
            type=AlertType.CRITICAL_FALL,
            severity=AlertSeverity.CRITICAL,
            patient_id=patient_id,
            message=message,
            acknowledged=False,
            created_at=datetime.now(timezone.utc),
        )
        return self.add_alert(alert)

    def create_demo_fall_alert(self) -> AlertEvent:
        return self.create_fall_alert("Fall detected in waiting room sector B")


from app.mock_data import MOCK_PATIENTS

state_service = StateService(seed_patients=MOCK_PATIENTS)
