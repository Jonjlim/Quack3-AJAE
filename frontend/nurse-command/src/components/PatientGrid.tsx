import type { PatientRecord } from "@shared/types/telemetry";
import { PatientCard } from "./PatientCard";

interface PatientGridProps {
  patients: PatientRecord[];
  onSelect: (patient: PatientRecord) => void;
}

export function PatientGrid({ patients, onSelect }: PatientGridProps) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-900">
      <header className="border-b border-slate-700 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Patient Grid ({patients.length})
        </h2>
      </header>
      <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2">
        {patients.map((patient) => (
          <PatientCard key={patient.patient_id} patient={patient} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
