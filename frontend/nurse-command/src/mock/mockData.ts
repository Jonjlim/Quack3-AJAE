import type { AcuityLevel, AlertEvent, PatientRecord } from "@shared/types/telemetry";

// ─── Patients ────────────────────────────────────────────────────────────────

export const MOCK_PATIENTS: PatientRecord[] = [
  {
    patient_id: "pat-001",
    display_name: "Sarah Chen",
    queue_position: 1,
    acuity: "EMERGENT",
    status: "ESCALATED",
    wait_minutes: 42,
    chief_complaint: "Chest pain, shortness of breath",
    camera_enabled: true,
    triage_reasoning: null,
    last_biometric: {
      patient_id: "pat-001",
      heart_rate_bpm: 98,
      heart_rate_bpm_low: 93,
      heart_rate_bpm_high: 103,
      respiratory_rate_bpm: 22,
      confidence: 0.87,
      measurement_status: "reliable",
      source: "rppg",
      recorded_at: "2026-05-30T17:30:00Z",
    },
    created_at: "2026-05-30T17:30:00Z",
  },
  {
    patient_id: "pat-002",
    display_name: "Marcus Johnson",
    queue_position: 2,
    acuity: "URGENT",
    status: "WAITING",
    wait_minutes: 28,
    chief_complaint: "Head injury after fall",
    camera_enabled: true,
    triage_reasoning: null,
    last_biometric: {
      patient_id: "pat-002",
      heart_rate_bpm: 88,
      heart_rate_bpm_low: 83,
      heart_rate_bpm_high: 93,
      respiratory_rate_bpm: 18,
      confidence: 0.87,
      measurement_status: "reliable",
      source: "rppg",
      recorded_at: "2026-05-30T17:44:00Z",
    },
    created_at: "2026-05-30T17:44:00Z",
  },
  {
    patient_id: "pat-003",
    display_name: "Emma Williams",
    queue_position: 3,
    acuity: "URGENT",
    status: "WAITING",
    wait_minutes: 19,
    chief_complaint: "Severe migraine with nausea",
    camera_enabled: true,
    triage_reasoning: null,
    last_biometric: {
      patient_id: "pat-003",
      heart_rate_bpm: 84,
      heart_rate_bpm_low: 79,
      heart_rate_bpm_high: 89,
      respiratory_rate_bpm: 17,
      confidence: 0.82,
      measurement_status: "reliable",
      source: "rppg",
      recorded_at: "2026-05-30T17:53:00Z",
    },
    created_at: "2026-05-30T17:53:00Z",
  },
  {
    patient_id: "pat-004",
    display_name: "David Park",
    queue_position: 4,
    acuity: "LESS_URGENT",
    status: "WAITING",
    wait_minutes: 14,
    chief_complaint: "Lower back pain, difficulty walking",
    camera_enabled: false,
    triage_reasoning: null,
    last_biometric: {
      patient_id: "pat-004",
      heart_rate_bpm: 74,
      heart_rate_bpm_low: 69,
      heart_rate_bpm_high: 79,
      respiratory_rate_bpm: 15,
      confidence: 0.84,
      measurement_status: "reliable",
      source: "rppg",
      recorded_at: "2026-05-30T17:58:00Z",
    },
    created_at: "2026-05-30T17:58:00Z",
  },
  {
    patient_id: "pat-005",
    display_name: "Lisa Torres",
    queue_position: 5,
    acuity: "LESS_URGENT",
    status: "WAITING",
    wait_minutes: 9,
    chief_complaint: "Persistent fever, sore throat",
    camera_enabled: false,
    triage_reasoning: null,
    last_biometric: {
      patient_id: "pat-005",
      heart_rate_bpm: 78,
      heart_rate_bpm_low: 73,
      heart_rate_bpm_high: 83,
      respiratory_rate_bpm: 16,
      confidence: 0.81,
      measurement_status: "reliable",
      source: "rppg",
      recorded_at: "2026-05-30T18:03:00Z",
    },
    created_at: "2026-05-30T18:03:00Z",
  },
  {
    patient_id: "pat-006",
    display_name: "Robert Kim",
    queue_position: 6,
    acuity: "NON_URGENT",
    status: "WAITING",
    wait_minutes: 5,
    chief_complaint: "Sprained ankle from sports",
    camera_enabled: false,
    triage_reasoning: null,
    last_biometric: {
      patient_id: "pat-006",
      heart_rate_bpm: 68,
      heart_rate_bpm_low: 63,
      heart_rate_bpm_high: 73,
      respiratory_rate_bpm: 14,
      confidence: 0.79,
      measurement_status: "reliable",
      source: "rppg",
      recorded_at: "2026-05-30T18:07:00Z",
    },
    created_at: "2026-05-30T18:07:00Z",
  },
];

export const MOCK_INITIAL_ALERTS: AlertEvent[] = [
  {
    alert_id: "alert-init-001",
    type: "BIOMETRIC_DROP",
    severity: "CRITICAL",
    patient_id: "pat-001",
    message: "Sarah Chen HR elevated: 98 bpm — monitor closely",
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
