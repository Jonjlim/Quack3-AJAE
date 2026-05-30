import type { AcuityLevel, BiometricReading, PatientRecord } from "@shared/types/telemetry";
import { PatientCard } from "./PatientCard";

// Base priority — sets the starting rank by clinical severity
const ACUITY_BASE: Record<AcuityLevel, number> = {
  RESUSCITATION: 5000,
  EMERGENT: 4000,
  URGENT: 3000,
  LESS_URGENT: 2000,
  NON_URGENT: 1000,
};

// Points earned per minute waiting — lower-acuity patients escalate faster
// so a long-waiting NON_URGENT can eventually overtake a recently arrived URGENT
const WAIT_RATE: Record<AcuityLevel, number> = {
  RESUSCITATION: 3,
  EMERGENT: 6,
  URGENT: 10,
  LESS_URGENT: 15,
  NON_URGENT: 20,
};

function priorityScore(patient: PatientRecord, alertCount: number): number {
  const base = ACUITY_BASE[patient.acuity] ?? 1000;
  const rate = WAIT_RATE[patient.acuity] ?? 20;
  const escalatedBonus = patient.status === "ESCALATED" ? 3000 : 0;
  const alertBonus = alertCount * 500;
  return base + patient.wait_minutes * rate + escalatedBonus + alertBonus;
}

interface PatientGridProps {
  patients: PatientRecord[];
  selectedPatientId: string | null;
  onSelect: (patient: PatientRecord) => void;
  hrHistory: Record<string, BiometricReading[]>;
  alertCountByPatient: Record<string, number>;
}

export function PatientGrid({
  patients,
  selectedPatientId,
  onSelect,
  hrHistory,
  alertCountByPatient,
}: PatientGridProps) {
  const sorted = [...patients].sort(
    (a, b) =>
      priorityScore(b, alertCountByPatient[b.patient_id] ?? 0) -
      priorityScore(a, alertCountByPatient[a.patient_id] ?? 0),
  );

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-slate-700 bg-slate-900">
      <header className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Patient queue
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">{patients.length} patients</p>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {sorted.map((patient) => (
          <PatientCard
            key={patient.patient_id}
            patient={patient}
            isSelected={patient.patient_id === selectedPatientId}
            onSelect={onSelect}
            hrData={hrHistory[patient.patient_id] ?? []}
            alertCount={alertCountByPatient[patient.patient_id] ?? 0}
          />
        ))}
      </div>
    </aside>
  );
}
