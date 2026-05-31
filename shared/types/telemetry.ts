/** Shared TypeScript types — mirror of shared/schemas/telemetry.py (manual sync). */

export const TELEMETRY_VERSION = "1.0" as const;

export type AlertType = "CRITICAL_FALL" | "BIOMETRIC_DROP" | "HELP_REQUEST";

export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PatientStatus =
  | "WAITING"
  | "STREAMING"
  | "IN_TRIAGE"
  | "ESCALATED";

export type AcuityLevel =
  | "RESUSCITATION"
  | "EMERGENT"
  | "URGENT"
  | "LESS_URGENT"
  | "NON_URGENT";

export type LiveKitRole = "patient" | "nurse" | "broad_camera";

export type TelemetryEventType =
  | "PATIENT_UPDATE"
  | "PATIENTS_SNAPSHOT"
  | "ACUITY_LOAD"
  | "BIOMETRIC"
  | "ALERT"
  | "QUEUE_UPDATE"
  | "HELP_ACK"
  | "CAMERA_STATUS";

export interface BiometricReading {
  patient_id: string;
  heart_rate_bpm: number | null;
  heart_rate_bpm_low?: number | null;
  heart_rate_bpm_high?: number | null;
  respiratory_rate_bpm: number | null;
  confidence: number;
  measurement_status?: "reliable" | "estimated" | "unreliable" | null;
  source: "rppg" | "manual";
  recorded_at: string;
}

export interface AcuityLoad {
  active_traumas: number;
  severe_count: number;
  emergent_count: number;
  total_waiting: number;
  estimated_wait_minutes: number;
  updated_at: string;
}

export interface PatientRecord {
  patient_id: string;
  display_name: string;
  queue_position: number;
  acuity: AcuityLevel;
  status: PatientStatus;
  wait_minutes: number;
  chief_complaint: string;
  triage_reasoning: string | null;
  camera_enabled: boolean;
  last_biometric: BiometricReading | null;
  created_at: string;
}

export interface AlertEvent {
  alert_id: string;
  type: AlertType;
  severity: AlertSeverity;
  patient_id: string | null;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface IntakeRequest {
  display_name: string;
  chief_complaint: string;
  acuity_self_report?: AcuityLevel;
}

export interface IntakeResponse {
  patient_id: string;
  queue_position: number;
  estimated_wait_minutes: number;
  created_at: string;
}

export interface QueueStatus {
  patient_id: string;
  queue_position: number;
  wait_minutes: number;
  estimated_wait_minutes: number;
  status: PatientStatus;
  acuity_load: AcuityLoad;
}

export interface LiveKitTokenRequest {
  room: string;
  identity: string;
  role: LiveKitRole;
  display_name?: string | null;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
  room: string;
  identity: string;
}

export interface AlertAckRequest {
  nurse_id: string;
  notes?: string;
}

export interface AlertAckResponse {
  alert_id: string;
  acknowledged: boolean;
  acknowledged_at: string;
}

export interface TelemetryEnvelope<T = Record<string, unknown>> {
  version: string;
  type: TelemetryEventType;
  timestamp: string;
  payload: T;
}

export interface HelpRequestPayload {
  patient_id: string;
  message?: string;
}

export interface CameraStatusPayload {
  patient_id: string;
  enabled: boolean;
}

export interface DemoFallTriggerResponse {
  alert: AlertEvent;
  broadcast: boolean;
}

/** Fall detected in the browser — reported to triage-engine. */
export interface BrowserFallReportRequest {
  confidence: number;
  danger_level: "low" | "medium" | "high";
  coordinates?: { x: number; y: number } | null;
  frame_timestamp?: number | null;
  source?: "browser";
  patient_id?: string | null;
  message?: string | null;
}

export interface FallReportResponse {
  alert: AlertEvent;
  broadcast: boolean;
  accepted: boolean;
}

export interface RppgQualityMetrics {
  face_coverage: number;
  motion_score: number;
  peak_prominence: number;
  chrom_fft_agreement_bpm: number | null;
}

export interface RppgAnalysisResult {
  heart_rate_bpm: number | null;
  heart_rate_bpm_low?: number | null;
  heart_rate_bpm_high?: number | null;
  confidence: number;
  signal_quality: "good" | "fair" | "poor";
  measurement_status: "reliable" | "estimated" | "unreliable";
  quality_metrics?: RppgQualityMetrics | null;
  error: string | null;
}

export interface SceneIntelRppgResponse {
  analysis: RppgAnalysisResult;
  biometric: BiometricReading | null;
  alert: AlertEvent | null;
  broadcast: boolean;
}

// ── Gemini Case File ─────────────────────────────────────────────────────────

/** Single chat turn between patient and Gemini. */
export interface CasefileMessage {
  role: "patient" | "gemini";
  content: string;
  timestamp: string;
}

/** Full conversation history for one patient. */
export interface CasefileConversation {
  patient_id: string;
  messages: CasefileMessage[];
  started_at: string | null;
}

/** Response from a single chat turn. */
export interface CasefileChatResponse {
  response: string;
  transcript: string;
  message_count: number;
}

/** Generated case-file report. */
export interface CasefileReportResponse {
  patient_id: string;
  report_markdown: string;
  generated_at: string;
}
