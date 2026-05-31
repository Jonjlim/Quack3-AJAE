import type { AcuityLevel } from "@shared/types/telemetry";

export const TRIAGE_CONFIG: Record<
  AcuityLevel,
  { num: number; label: string; desc: string; color: string; dimBg: string; dimText: string }
> = {
  RESUSCITATION: { num: 1, label: "Resuscitation", desc: "Immediate life threat", color: "#dc2626", dimBg: "#fef2f2", dimText: "#b91c1c" },
  EMERGENT:      { num: 2, label: "Emergent",      desc: "May deteriorate rapidly", color: "#ea580c", dimBg: "#fff7ed", dimText: "#c2410c" },
  URGENT:        { num: 3, label: "Urgent",        desc: "Needs prompt care",       color: "#d97706", dimBg: "#fefce8", dimText: "#a16207" },
  LESS_URGENT:   { num: 4, label: "Less urgent",   desc: "Stable, can wait",        color: "#15803d", dimBg: "#f0fdf4", dimText: "#15803d" },
  NON_URGENT:    { num: 5, label: "Non-urgent",    desc: "Minor complaint",          color: "#6b7280", dimBg: "#f9fafb", dimText: "#4b5563" },
};

export const ACUITY_ORDER: AcuityLevel[] = [
  "RESUSCITATION",
  "EMERGENT",
  "URGENT",
  "LESS_URGENT",
  "NON_URGENT",
];

export const ACUITY_SEVERITY: Record<AcuityLevel, number> = {
  RESUSCITATION: 0,
  EMERGENT: 1,
  URGENT: 2,
  LESS_URGENT: 3,
  NON_URGENT: 4,
};

export type WizardStep = "identity" | "complaint" | "handoff";

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: "identity", label: "Identity" },
  { id: "complaint", label: "Complaint" },
  { id: "handoff", label: "Handoff" },
];

export const ER_DOCUMENT_ITEMS = [
  { id: "photo_id", label: "Photo ID" },
  { id: "insurance", label: "Insurance card" },
  { id: "consent", label: "Consent signed" },
  { id: "emergency_contact", label: "Emergency contact" },
  { id: "med_list", label: "Medication list" },
  { id: "allergies", label: "Allergies documented" },
] as const;

export type ErDocumentId = (typeof ER_DOCUMENT_ITEMS)[number]["id"];
