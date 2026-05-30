from shared.schemas.telemetry import AcuityLevel, PatientRecord

ACUITY_WEIGHT: dict[AcuityLevel, int] = {
    AcuityLevel.RESUSCITATION: 5,
    AcuityLevel.EMERGENT: 4,
    AcuityLevel.URGENT: 3,
    AcuityLevel.LESS_URGENT: 2,
    AcuityLevel.NON_URGENT: 1,
}


def sort_patients(patients: list[PatientRecord]) -> list[PatientRecord]:
    """Acuity-weighted triage sort — higher acuity and longer wait rise to the top."""
    return sorted(
        patients,
        key=lambda p: (
            -ACUITY_WEIGHT[p.acuity],
            -p.wait_minutes,
            p.queue_position,
        ),
    )
