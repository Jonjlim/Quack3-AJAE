"""Shared Pydantic v2 schemas — source of truth for ER-OVERWATCH telemetry."""

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


TELEMETRY_VERSION = "1.0"


class AlertType(str, Enum):
    CRITICAL_FALL = "CRITICAL_FALL"
    BIOMETRIC_DROP = "BIOMETRIC_DROP"
    HELP_REQUEST = "HELP_REQUEST"


class AlertSeverity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class PatientStatus(str, Enum):
    WAITING = "WAITING"
    STREAMING = "STREAMING"
    IN_TRIAGE = "IN_TRIAGE"
    ESCALATED = "ESCALATED"


class AcuityLevel(str, Enum):
    RESUSCITATION = "RESUSCITATION"
    EMERGENT = "EMERGENT"
    URGENT = "URGENT"
    LESS_URGENT = "LESS_URGENT"
    NON_URGENT = "NON_URGENT"


class LiveKitRole(str, Enum):
    PATIENT = "patient"
    NURSE = "nurse"
    BROAD_CAMERA = "broad_camera"


class TelemetryEventType(str, Enum):
    PATIENT_UPDATE = "PATIENT_UPDATE"
    PATIENTS_SNAPSHOT = "PATIENTS_SNAPSHOT"
    ACUITY_LOAD = "ACUITY_LOAD"
    BIOMETRIC = "BIOMETRIC"
    ALERT = "ALERT"
    QUEUE_UPDATE = "QUEUE_UPDATE"
    HELP_ACK = "HELP_ACK"
    CAMERA_STATUS = "CAMERA_STATUS"


class BiometricReading(BaseModel):
    patient_id: str
    heart_rate_bpm: float | None = None
    respiratory_rate_bpm: float | None = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    source: Literal["rppg", "manual"] = "rppg"
    recorded_at: datetime


class AcuityLoad(BaseModel):
    active_traumas: int = Field(ge=0)
    severe_count: int = Field(ge=0)
    emergent_count: int = Field(ge=0)
    total_waiting: int = Field(ge=0)
    estimated_wait_minutes: int = Field(ge=0)
    updated_at: datetime


class PatientRecord(BaseModel):
    patient_id: str
    display_name: str
    queue_position: int = Field(ge=1)
    acuity: AcuityLevel
    status: PatientStatus
    wait_minutes: int = Field(ge=0)
    chief_complaint: str
    camera_enabled: bool = False
    last_biometric: BiometricReading | None = None
    created_at: datetime


class AlertEvent(BaseModel):
    alert_id: str
    type: AlertType
    severity: AlertSeverity
    patient_id: str | None = None
    message: str
    acknowledged: bool = False
    created_at: datetime


class IntakeRequest(BaseModel):
    display_name: str
    chief_complaint: str
    acuity_self_report: AcuityLevel | None = None


class IntakeResponse(BaseModel):
    patient_id: str
    queue_position: int
    estimated_wait_minutes: int
    created_at: datetime


class QueueStatus(BaseModel):
    patient_id: str
    queue_position: int
    wait_minutes: int
    estimated_wait_minutes: int
    status: PatientStatus
    acuity_load: AcuityLoad


class LiveKitTokenRequest(BaseModel):
    room: str
    identity: str
    role: LiveKitRole


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str
    room: str
    identity: str


class AlertAckRequest(BaseModel):
    nurse_id: str
    notes: str | None = None


class AlertAckResponse(BaseModel):
    alert_id: str
    acknowledged: bool
    acknowledged_at: datetime


class TelemetryEnvelope(BaseModel):
    version: str = TELEMETRY_VERSION
    type: TelemetryEventType
    timestamp: datetime
    payload: dict[str, Any]


class HelpRequestPayload(BaseModel):
    patient_id: str
    message: str = "Immediate help requested"


class CameraStatusPayload(BaseModel):
    patient_id: str
    enabled: bool


class DemoFallTriggerResponse(BaseModel):
    alert: AlertEvent
    broadcast: bool


class FallDetectionResult(BaseModel):
    fall_detected: bool
    confidence: float = Field(ge=0.0, le=1.0)
    danger_level: Literal["low", "medium", "high"]
    coordinates: dict[str, int] | None = None
    frame_timestamp: float | None = None


class SceneIntelFallResponse(BaseModel):
    analysis: FallDetectionResult
    alert: AlertEvent | None = None
    broadcast: bool = False


class RppgAnalysisResult(BaseModel):
    heart_rate_bpm: float | None = None
    confidence: float = Field(ge=0.0, le=1.0, default=0.0)
    signal_quality: Literal["good", "fair", "poor"]
    error: str | None = None


class SceneIntelRppgResponse(BaseModel):
    analysis: RppgAnalysisResult
    biometric: BiometricReading | None = None
    alert: AlertEvent | None = None
    broadcast: bool = False
