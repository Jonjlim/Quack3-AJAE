import type { PatientRecord } from "@shared/types/telemetry";

interface PatientCardProps {
  patient: PatientRecord;
  onSelect: (patient: PatientRecord) => void;
}

const ACUITY_COLORS: Record<string, string> = {
  RESUSCITATION: "border-red-500 bg-red-950/50",
  EMERGENT: "border-orange-500 bg-orange-950/40",
  URGENT: "border-amber-500 bg-amber-950/30",
  LESS_URGENT: "border-blue-500 bg-blue-950/20",
  NON_URGENT: "border-slate-600 bg-slate-800/50",
};

export function PatientCard({ patient, onSelect }: PatientCardProps) {
  const colorClass = ACUITY_COLORS[patient.acuity] ?? ACUITY_COLORS.NON_URGENT;

  return (
    <button
      type="button"
      onClick={() => onSelect(patient)}
      className={`rounded-lg border-l-4 p-4 text-left transition hover:brightness-110 ${colorClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-white">{patient.display_name}</p>
          <p className="mt-1 text-xs text-slate-400">#{patient.queue_position} · {patient.acuity}</p>
        </div>
        <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
          {patient.wait_minutes}m
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-slate-300">{patient.chief_complaint}</p>
      {patient.last_biometric && (
        <p className="mt-2 text-xs text-emerald-400">
          HR {patient.last_biometric.heart_rate_bpm} · RR {patient.last_biometric.respiratory_rate_bpm}
        </p>
      )}
      {patient.camera_enabled && (
        <span className="mt-2 inline-block text-xs text-blue-400">Camera active</span>
      )}
    </button>
  );
}
