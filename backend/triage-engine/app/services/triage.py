from datetime import datetime, timezone

from shared.schemas.telemetry import (
    AcuityLevel,
    AcuityLoad,
    AlertSeverity,
    BiometricReading,
    PatientRecord,
    PatientStatus,
)

ACUITY_WEIGHT: dict[AcuityLevel, int] = {
    AcuityLevel.RESUSCITATION: 5,
    AcuityLevel.EMERGENT: 4,
    AcuityLevel.URGENT: 3,
    AcuityLevel.LESS_URGENT: 2,
    AcuityLevel.NON_URGENT: 1,
}

# Rough minutes added to the queue per patient ahead, by acuity tier.
ACUITY_MINUTES: dict[AcuityLevel, int] = {
    AcuityLevel.RESUSCITATION: 0,
    AcuityLevel.EMERGENT: 12,
    AcuityLevel.URGENT: 18,
    AcuityLevel.LESS_URGENT: 25,
    AcuityLevel.NON_URGENT: 35,
}

CRITICAL_HR_BPM = 50
HR_DROP_RATIO = 0.8
MIN_ALERT_CONFIDENCE = 0.6


def format_hr_alert_message(reading: BiometricReading) -> str:
    hr = reading.heart_rate_bpm
    if hr is None:
        return "Critical biometric drop detected"
    if reading.heart_rate_bpm_low is not None and reading.heart_rate_bpm_high is not None:
        conf = f", {reading.confidence:.0%} confidence" if reading.confidence else ""
        return (
            f"Critical biometric drop detected (HR {hr:.0f} bpm "
            f"({reading.heart_rate_bpm_low:.0f}–{reading.heart_rate_bpm_high:.0f}){conf})"
        )
    return f"Critical biometric drop detected (HR {hr:.0f} bpm)"


def wait_minutes_since(created_at: datetime, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    elapsed = (now - created_at).total_seconds()
    return max(0, int(elapsed // 60))


def sort_key(patient: PatientRecord) -> tuple[float, float, float]:
    """Higher acuity, escalated status, and longer waits sort to the front."""
    weight = float(ACUITY_WEIGHT[patient.acuity])
    if patient.status == PatientStatus.ESCALATED:
        weight += 0.5
    if patient.status == PatientStatus.IN_TRIAGE:
        weight = -1.0
    return (-weight, -float(patient.wait_minutes), patient.created_at.timestamp())


def sort_patients(patients: list[PatientRecord]) -> list[PatientRecord]:
    return sorted(patients, key=sort_key)


def assign_queue_positions(patients: list[PatientRecord]) -> list[PatientRecord]:
    """Return a new list with queue_position 1..n reflecting triage order."""
    sorted_patients = sort_patients(patients)
    return [
        patient.model_copy(update={"queue_position": index})
        for index, patient in enumerate(sorted_patients, start=1)
    ]


def estimate_wait_minutes(sorted_patients: list[PatientRecord], patient_id: str) -> int:
    """Sum expected minutes for every patient ahead in the sorted queue."""
    total = 0
    for patient in sorted_patients:
        if patient.patient_id == patient_id:
            return total
        if patient.status != PatientStatus.IN_TRIAGE:
            total += ACUITY_MINUTES[patient.acuity]
    return total


def compute_acuity_load(patients: list[PatientRecord], now: datetime | None = None) -> AcuityLoad:
    now = now or datetime.now(timezone.utc)
    active = [p for p in patients if p.status != PatientStatus.IN_TRIAGE]
    severe = sum(1 for p in active if p.acuity == AcuityLevel.RESUSCITATION)
    emergent = sum(1 for p in active if p.acuity == AcuityLevel.EMERGENT)
    avg_wait = (
        int(sum(p.wait_minutes for p in active) / len(active)) if active else 0
    )

    return AcuityLoad(
        active_traumas=severe + emergent,
        severe_count=severe,
        emergent_count=emergent,
        total_waiting=len(active),
        estimated_wait_minutes=max(avg_wait, 15),
        updated_at=now,
    )


def is_biometric_critical(
    reading: BiometricReading,
    previous: BiometricReading | None,
) -> bool:
    if reading.confidence < MIN_ALERT_CONFIDENCE:
        return False
    if reading.measurement_status == "unreliable":
        return False

    hr = reading.heart_rate_bpm
    if hr is not None and hr < CRITICAL_HR_BPM:
        return True
    if (
        previous
        and previous.heart_rate_bpm
        and hr is not None
        and hr < previous.heart_rate_bpm * HR_DROP_RATIO
    ):
        return True
    return False


def bump_acuity(current: AcuityLevel) -> AcuityLevel:
    order = list(AcuityLevel)
    index = order.index(current)
    return order[max(0, index - 1)]
