from datetime import datetime, timezone

from shared.schemas.telemetry import (
    AcuityLevel,
    AcuityLoad,
    AlertEvent,
    AlertSeverity,
    AlertType,
    BiometricReading,
    PatientRecord,
    PatientStatus,
)

NOW = datetime(2026, 5, 30, 18, 12, 0, tzinfo=timezone.utc)

MOCK_ACUITY_LOAD = AcuityLoad(
    active_traumas=1,
    severe_count=2,
    emergent_count=2,
    total_waiting=6,
    estimated_wait_minutes=35,
    updated_at=NOW,
)


def _bio(pid: str, hr: float, rr: float, conf: float = 0.87) -> BiometricReading:
    return BiometricReading(
        patient_id=pid,
        heart_rate_bpm=hr,
        heart_rate_bpm_low=round(hr - 5, 1),
        heart_rate_bpm_high=round(hr + 5, 1),
        respiratory_rate_bpm=rr,
        confidence=conf,
        measurement_status="reliable",
        source="rppg",
        recorded_at=NOW,
    )


MOCK_PATIENTS: list[PatientRecord] = [
    PatientRecord(
        patient_id="pat-001",
        display_name="Sarah Chen",
        queue_position=1,
        acuity=AcuityLevel.EMERGENT,
        status=PatientStatus.ESCALATED,
        wait_minutes=42,
        chief_complaint="Chest pain, shortness of breath",
        camera_enabled=True,
        last_biometric=_bio("pat-001", 98.0, 22.0),
        created_at=datetime(2026, 5, 30, 17, 30, 0, tzinfo=timezone.utc),
    ),
    PatientRecord(
        patient_id="pat-002",
        display_name="Marcus Johnson",
        queue_position=2,
        acuity=AcuityLevel.URGENT,
        status=PatientStatus.WAITING,
        wait_minutes=28,
        chief_complaint="Head injury after fall",
        camera_enabled=True,
        last_biometric=_bio("pat-002", 88.0, 18.0),
        created_at=datetime(2026, 5, 30, 17, 44, 0, tzinfo=timezone.utc),
    ),
    PatientRecord(
        patient_id="pat-003",
        display_name="Emma Williams",
        queue_position=3,
        acuity=AcuityLevel.URGENT,
        status=PatientStatus.WAITING,
        wait_minutes=19,
        chief_complaint="Severe migraine with nausea",
        camera_enabled=True,
        last_biometric=_bio("pat-003", 84.0, 17.0, 0.82),
        created_at=datetime(2026, 5, 30, 17, 53, 0, tzinfo=timezone.utc),
    ),
    PatientRecord(
        patient_id="pat-004",
        display_name="David Park",
        queue_position=4,
        acuity=AcuityLevel.LESS_URGENT,
        status=PatientStatus.WAITING,
        wait_minutes=14,
        chief_complaint="Lower back pain, difficulty walking",
        camera_enabled=False,
        last_biometric=_bio("pat-004", 74.0, 15.0, 0.84),
        created_at=datetime(2026, 5, 30, 17, 58, 0, tzinfo=timezone.utc),
    ),
    PatientRecord(
        patient_id="pat-005",
        display_name="Lisa Torres",
        queue_position=5,
        acuity=AcuityLevel.LESS_URGENT,
        status=PatientStatus.WAITING,
        wait_minutes=9,
        chief_complaint="Persistent fever, sore throat",
        camera_enabled=False,
        last_biometric=_bio("pat-005", 78.0, 16.0, 0.81),
        created_at=datetime(2026, 5, 30, 18, 3, 0, tzinfo=timezone.utc),
    ),
    PatientRecord(
        patient_id="pat-006",
        display_name="Robert Kim",
        queue_position=6,
        acuity=AcuityLevel.NON_URGENT,
        status=PatientStatus.WAITING,
        wait_minutes=5,
        chief_complaint="Sprained ankle from sports",
        camera_enabled=False,
        last_biometric=_bio("pat-006", 68.0, 14.0, 0.79),
        created_at=datetime(2026, 5, 30, 18, 7, 0, tzinfo=timezone.utc),
    ),
]

MOCK_ALERTS: list[AlertEvent] = []
