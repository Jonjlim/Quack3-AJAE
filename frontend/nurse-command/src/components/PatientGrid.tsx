import type { AcuityLevel, PatientRecord } from "@shared/types/telemetry";
import type { RemoteVideoTrack } from "../hooks/useLiveKitRoom";
import { PatientCard } from "./PatientCard";

const ACUITY_BASE: Record<AcuityLevel, number> = {
  RESUSCITATION: 5000,
  EMERGENT: 4000,
  URGENT: 3000,
  LESS_URGENT: 2000,
  NON_URGENT: 1000,
};

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
  alertCountByPatient: Record<string, number>;
  getVideoForIdentity: (identity: string) => RemoteVideoTrack | null;
  /** When true, omits outer panel wrapper (parent provides container). */
  embedded?: boolean;
}

export function PatientGrid({
  patients,
  selectedPatientId,
  onSelect,
  alertCountByPatient,
  getVideoForIdentity,
  embedded = false,
}: PatientGridProps) {
  const sorted = [...patients].sort(
    (a, b) =>
      priorityScore(b, alertCountByPatient[b.patient_id] ?? 0) -
      priorityScore(a, alertCountByPatient[a.patient_id] ?? 0),
  );

  const content = (
    <>
      <header className="panel-header flex-shrink-0">
        <h2 className="telemetry-label text-[var(--text)]">Patient Queue</h2>
        <p className="telemetry-value mt-0.5 text-[10px] text-[var(--text-muted)]">
          {patients.length} active
        </p>
      </header>
      <div className="min-h-0 flex-1 space-y-px overflow-y-auto bg-[var(--border-subtle)] p-px">
        {sorted.map((patient) => (
          <PatientCard
            key={patient.patient_id}
            patient={patient}
            isSelected={patient.patient_id === selectedPatientId}
            onSelect={onSelect}
            alertCount={alertCountByPatient[patient.patient_id] ?? 0}
            patientVideo={getVideoForIdentity(patient.patient_id)}
          />
        ))}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{content}</div>;
  }

  return <aside className="panel flex w-64 flex-shrink-0 flex-col">{content}</aside>;
}
