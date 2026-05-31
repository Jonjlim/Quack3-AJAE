import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { AcuityLevel, BiometricReading, PatientRecord } from "@shared/types/telemetry";

interface PatientCardProps {
  patient: PatientRecord;
  isSelected: boolean;
  onSelect: (patient: PatientRecord) => void;
  hrData: BiometricReading[];
  alertCount: number;
}

const ACUITY_META: Record<
  AcuityLevel,
  { triageNum: number; triageColor: string; statusColor: string; statusLabel: string }
> = {
  RESUSCITATION: { triageNum: 1, triageColor: "#E24B4A", statusColor: "#E24B4A", statusLabel: "URGENT" },
  EMERGENT:      { triageNum: 2, triageColor: "#f97316", statusColor: "#E24B4A", statusLabel: "URGENT" },
  URGENT:        { triageNum: 3, triageColor: "#eab308", statusColor: "#BA7517", statusLabel: "WATCH"  },
  LESS_URGENT:   { triageNum: 4, triageColor: "#22c55e", statusColor: "#639922", statusLabel: "STABLE" },
  NON_URGENT:    { triageNum: 5, triageColor: "#3b82f6", statusColor: "#639922", statusLabel: "STABLE" },
};

function formatHrDisplay(bio: BiometricReading | null | undefined): { value: string; sub?: string; muted: boolean } {
  if (bio?.heart_rate_bpm == null) {
    return { value: "—", muted: true };
  }
  const muted = bio.confidence < 0.5 || bio.measurement_status === "unreliable";
  let sub: string | undefined;
  if (bio.heart_rate_bpm_low != null && bio.heart_rate_bpm_high != null) {
    sub = `${Math.round(bio.heart_rate_bpm_low)}–${Math.round(bio.heart_rate_bpm_high)}`;
  }
  return { value: String(Math.round(bio.heart_rate_bpm)), sub, muted };
}

function confidenceLabel(bio: BiometricReading | null | undefined): string | null {
  if (!bio || bio.confidence <= 0) return null;
  if (bio.measurement_status === "reliable" || bio.confidence >= 0.65) return "Reliable";
  if (bio.measurement_status === "estimated" || bio.confidence >= 0.5) return "Estimated";
  return "Low confidence";
}

function formatElapsed(baseMinutes: number, extraSeconds: number): string {
  const total = baseMinutes * 60 + extraSeconds;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

export function PatientCard({ patient, isSelected, onSelect, hrData, alertCount }: PatientCardProps) {
  const [extraSeconds, setExtraSeconds] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setExtraSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const meta = ACUITY_META[patient.acuity] ?? ACUITY_META.NON_URGENT;
  const bio = patient.last_biometric;
  const hrDisplay = formatHrDisplay(bio);
  const confLabel = confidenceLabel(bio);

  return (
    <button
      type="button"
      onClick={() => onSelect(patient)}
      className="w-full cursor-pointer rounded-lg p-3 text-left transition-all duration-150 hover:brightness-110"
      style={{
        background: isSelected ? "#1a2540" : "#0d1526",
        borderTop: `1px solid ${isSelected ? meta.statusColor + "60" : "#1e293b"}`,
        borderRight: `1px solid ${isSelected ? meta.statusColor + "60" : "#1e293b"}`,
        borderBottom: `1px solid ${isSelected ? meta.statusColor + "60" : "#1e293b"}`,
        borderLeft: `4px solid ${meta.statusColor}`,
      }}
    >
      {/* Row 1: name + triage badge + status + alert count */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: meta.statusColor }}
          />
          <span className="text-sm font-bold text-white">{patient.display_name}</span>
          <span
            className="rounded px-1.5 py-0.5 text-xs font-bold"
            style={{
              background: meta.triageColor + "30",
              color: meta.triageColor,
              border: `1px solid ${meta.triageColor}70`,
            }}
          >
            T{meta.triageNum}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {alertCount > 0 && (
            <span
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: "#E24B4A" }}
            >
              {alertCount}
            </span>
          )}
          <span className="text-xs font-semibold uppercase" style={{ color: meta.statusColor }}>
            {meta.statusLabel}
          </span>
        </div>
      </div>

      {/* Row 2: patient ID + complaint */}
      <p className="mb-0.5 font-mono text-[11px] tracking-wide text-slate-500">{patient.patient_id}</p>
      <p className="mb-2 line-clamp-1 text-sm text-slate-300">{patient.chief_complaint}</p>

      {/* Row 3: HR value + sparkline */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-slate-500">HR</span>
            <span
              className="tabular-nums text-base font-bold"
              style={{ color: hrDisplay.muted ? "#64748b" : meta.statusColor }}
            >
              {hrDisplay.value}
            </span>
            {hrDisplay.sub && (
              <span className="text-xs text-slate-500">({hrDisplay.sub})</span>
            )}
            <span className="text-xs text-slate-600">bpm</span>
          </div>
          {confLabel && (
            <span
              className="text-[10px] font-medium uppercase tracking-wide"
              style={{ color: hrDisplay.muted ? "#475569" : "#94a3b8" }}
            >
              {confLabel}
            </span>
          )}
        </div>
        {hrData.length > 1 && (
          <div className="h-8 min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hrData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <Line
                  type="monotone"
                  dataKey="heart_rate_bpm"
                  stroke={meta.statusColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Row 4: AI triage reasoning */}
      {patient.triage_reasoning && (
        <p className="mt-1.5 line-clamp-2 text-[11px] italic text-slate-500">
          <span className="not-italic font-medium text-violet-400">AI Analysis · </span>
          {patient.triage_reasoning}
        </p>
      )}

      {/* Row 5: wait time */}
      <p className="mt-1.5 text-xs text-slate-600">
        Waiting: {formatElapsed(patient.wait_minutes, extraSeconds)}
      </p>
    </button>
  );
}
