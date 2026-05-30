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
    active_traumas=2,
    severe_count=1,
    emergent_count=3,
    total_waiting=14,
    estimated_wait_minutes=45,
    updated_at=NOW,
)

MOCK_BIOMETRIC_PAT_002 = BiometricReading(
    patient_id="pat-002",
    heart_rate_bpm=112.0,
    respiratory_rate_bpm=22.0,
    confidence=0.87,
    source="rppg",
    recorded_at=datetime(2026, 5, 30, 18, 11, 0, tzinfo=timezone.utc),
)

MOCK_PATIENTS: list[PatientRecord] = [
    PatientRecord(
        patient_id="pat-002",
        display_name="Jordan K.",
        queue_position=1,
        acuity=AcuityLevel.EMERGENT,
        status=PatientStatus.ESCALATED,
        wait_minutes=28,
        chief_complaint="Severe abdominal pain",
        camera_enabled=True,
        last_biometric=MOCK_BIOMETRIC_PAT_002,
        created_at=datetime(2026, 5, 30, 17, 44, 0, tzinfo=timezone.utc),
    ),
    PatientRecord(
        patient_id="pat-001",
        display_name="Alex M.",
        queue_position=4,
        acuity=AcuityLevel.URGENT,
        status=PatientStatus.WAITING,
        wait_minutes=12,
        chief_complaint="Chest pain, difficulty breathing",
        camera_enabled=False,
        last_biometric=None,
        created_at=datetime(2026, 5, 30, 18, 0, 0, tzinfo=timezone.utc),
    ),
]

MOCK_ALERTS: list[AlertEvent] = []
