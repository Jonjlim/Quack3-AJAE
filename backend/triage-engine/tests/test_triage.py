import pytest

from datetime import datetime, timezone

from shared.schemas.telemetry import AcuityLevel, BiometricReading, PatientRecord, PatientStatus

from app.services.triage import assign_queue_positions, is_biometric_critical, sort_patients


def _bio(
    hr: float,
    *,
    status: str = "reliable",
    confidence: float = 0.75,
) -> BiometricReading:
    return BiometricReading(
        patient_id="pat-test",
        heart_rate_bpm=hr,
        confidence=confidence,
        measurement_status=status,  # type: ignore[arg-type]
        recorded_at=datetime.now(timezone.utc),
    )


def _patient(pid: str, acuity: AcuityLevel, wait: int, status: PatientStatus = PatientStatus.WAITING) -> PatientRecord:
    from datetime import datetime, timezone
    return PatientRecord(
        patient_id=pid,
        display_name=pid,
        queue_position=99,
        acuity=acuity,
        status=status,
        wait_minutes=wait,
        chief_complaint="test",
        camera_enabled=False,
        last_biometric=None,
        created_at=datetime.now(timezone.utc),
    )


def test_emergent_patient_sorts_ahead_of_urgent():
    patients = [
        _patient("pat-low", AcuityLevel.URGENT, 30),
        _patient("pat-high", AcuityLevel.EMERGENT, 5),
    ]
    sorted_ids = [p.patient_id for p in sort_patients(patients)]
    assert sorted_ids == ["pat-high", "pat-low"]


def test_escalated_patient_jumps_queue():
    patients = [
        _patient("pat-a", AcuityLevel.URGENT, 20),
        _patient("pat-b", AcuityLevel.URGENT, 10, PatientStatus.ESCALATED),
    ]
    sorted_ids = [p.patient_id for p in sort_patients(patients)]
    assert sorted_ids[0] == "pat-b"


def test_assign_queue_positions_are_sequential():
    patients = [
        _patient("pat-a", AcuityLevel.LESS_URGENT, 5),
        _patient("pat-b", AcuityLevel.EMERGENT, 1),
    ]
    positioned = assign_queue_positions(patients)
    assert positioned[0].patient_id == "pat-b"
    assert positioned[0].queue_position == 1
    assert positioned[1].queue_position == 2


def test_biometric_critical_ignores_estimated_spike():
    previous = _bio(130)
    current = _bio(60, status="estimated")
    assert is_biometric_critical(current, previous) is False


def test_biometric_critical_ignores_small_reliable_drops():
    previous = _bio(80)
    current = _bio(68)
    assert is_biometric_critical(current, previous) is False


def test_biometric_critical_fires_on_sustained_reliable_drop():
    previous = _bio(95)
    current = _bio(62)
    assert is_biometric_critical(current, previous) is True
