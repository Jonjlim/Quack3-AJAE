import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from shared.schemas.telemetry import (
    AcuityLoad,
    AlertEvent,
    AlertAckRequest,
    AlertAckResponse,
    BiometricReading,
    DemoFallTriggerResponse,
    HelpRequestPayload,
    IntakeRequest,
    IntakeResponse,
    LiveKitTokenRequest,
    LiveKitTokenResponse,
    PatientRecord,
    QueueStatus,
    TelemetryEnvelope,
    TelemetryEventType,
)

__all__ = [
    "AcuityLoad",
    "AlertEvent",
    "AlertAckRequest",
    "AlertAckResponse",
    "BiometricReading",
    "DemoFallTriggerResponse",
    "HelpRequestPayload",
    "IntakeRequest",
    "IntakeResponse",
    "LiveKitTokenRequest",
    "LiveKitTokenResponse",
    "PatientRecord",
    "QueueStatus",
    "TelemetryEnvelope",
    "TelemetryEventType",
]
