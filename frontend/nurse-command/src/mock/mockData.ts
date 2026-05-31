import type { AcuityLevel, AlertEvent, PatientRecord } from "@shared/types/telemetry";

// ─── Patients ────────────────────────────────────────────────────────────────

export const MOCK_PATIENTS: PatientRecord[] = [
  {
    patient_id: "pat-001",
    display_name: "P-01",
    queue_position: 1,
    acuity: "EMERGENT",
    status: "ESCALATED",
    wait_minutes: 112,
    chief_complaint: "Chest pain, shortness of breath",
    camera_enabled: true,
    last_biometric: {
      patient_id: "pat-001",
      heart_rate_bpm: 118,
      respiratory_rate_bpm: 22,
      confidence: 0.91,
      source: "rppg",
      recorded_at: "2026-05-30T18:20:00Z",
    },
    created_at: "2026-05-30T16:28:00Z",
  },
  {
    patient_id: "pat-002",
    display_name: "P-02",
    queue_position: 2,
    acuity: "URGENT",
    status: "WAITING",
    wait_minutes: 48,
    chief_complaint: "Severe abdominal pain",
    camera_enabled: true,
    last_biometric: {
      patient_id: "pat-002",
      heart_rate_bpm: 95,
      respiratory_rate_bpm: 17,
      confidence: 0.87,
      source: "rppg",
      recorded_at: "2026-05-30T18:11:00Z",
    },
    created_at: "2026-05-30T17:31:00Z",
  },
  {
    patient_id: "pat-003",
    display_name: "P-03",
    queue_position: 3,
    acuity: "LESS_URGENT",
    status: "WAITING",
    wait_minutes: 22,
    chief_complaint: "Lower back pain",
    camera_enabled: false,
    last_biometric: {
      patient_id: "pat-003",
      heart_rate_bpm: 70,
      respiratory_rate_bpm: 15,
      confidence: 0.82,
      source: "rppg",
      recorded_at: "2026-05-30T18:17:00Z",
    },
    created_at: "2026-05-30T17:57:00Z",
  },
  {
    patient_id: "pat-004",
    display_name: "P-04",
    queue_position: 4,
    acuity: "NON_URGENT",
    status: "WAITING",
    wait_minutes: 11,
    chief_complaint: "Sprained ankle",
    camera_enabled: false,
    last_biometric: {
      patient_id: "pat-004",
      heart_rate_bpm: 76,
      respiratory_rate_bpm: 14,
      confidence: 0.78,
      source: "rppg",
      recorded_at: "2026-05-30T18:08:00Z",
    },
    created_at: "2026-05-30T18:08:00Z",
  },
];

export const MOCK_INITIAL_ALERTS: AlertEvent[] = [
  {
    alert_id: "alert-init-001",
    type: "BIOMETRIC_DROP",
    severity: "CRITICAL",
    patient_id: "pat-001",
    message: "P-01 HR critical: 118 bpm — significantly elevated",
    acknowledged: false,
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
];

// ─── Check-in form ────────────────────────────────────────────────────────────

export interface ComplaintTile {
  label: string;
  suggestedAcuity: AcuityLevel | null;
}

export const COMPLAINT_TILES: ComplaintTile[] = [
  { label: "Chest pain",          suggestedAcuity: "EMERGENT" },
  { label: "Shortness of breath", suggestedAcuity: "EMERGENT" },
  { label: "Abdominal pain",      suggestedAcuity: "URGENT" },
  { label: "Head injury",         suggestedAcuity: "EMERGENT" },
  { label: "Stroke symptoms",     suggestedAcuity: "RESUSCITATION" },
  { label: "Severe bleeding",     suggestedAcuity: "RESUSCITATION" },
  { label: "Back pain",           suggestedAcuity: "LESS_URGENT" },
  { label: "Fracture/injury",     suggestedAcuity: "URGENT" },
  { label: "Sprained ankle",      suggestedAcuity: "NON_URGENT" },
  { label: "Other",               suggestedAcuity: null },
];

export const SYMPTOMS = [
  "Pain", "Nausea", "Dizziness", "Shortness of breath",
  "Confusion", "Bleeding", "Fever", "Numbness",
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

export const CV_TRACK_MAP: Record<string, string[]> = {
  "Chest pain":          ["HR spike", "stillness", "chest clutching", "labored breathing"],
  "Shortness of breath": ["labored breathing", "HR spike", "chest movement", "stillness"],
  "Abdominal pain":      ["guarding posture", "doubling over", "HR elevation"],
  "Head injury":         ["head drooping", "confusion gestures", "stillness", "HR spike"],
  "Stroke symptoms":     ["facial asymmetry", "head drooping", "confusion gestures"],
  "Severe bleeding":     ["stillness", "HR spike", "collapse", "labored breathing"],
  "Back pain":           [],
  "Fracture/injury":     ["HR spike", "stillness"],
  "Sprained ankle":      [],
  "Other":               [],
};

export const CV_IGNORE_MAP: Record<string, string[]> = {
  "Back pain":       ["guarding posture", "hunching"],
  "Sprained ankle":  ["limping", "guarding ankle"],
  "Fracture/injury": ["limping", "guarding injury"],
};

export const ALERT_SENSITIVITY: Record<AcuityLevel, string> = {
  RESUSCITATION: "maximum",
  EMERGENT:      "high",
  URGENT:        "medium",
  LESS_URGENT:   "low",
  NON_URGENT:    "minimal",
};

export const UNIVERSAL_FLAGS = [
  "full_collapse",
  "prolonged_unresponsiveness",
  "hr_critical",
  "help_requested",
];
