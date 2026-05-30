import pytest

from shared.schemas.telemetry import AcuityLevel, PatientRecord, PatientStatus

from app.services.triage import assign_queue_positions, sort_patients


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
