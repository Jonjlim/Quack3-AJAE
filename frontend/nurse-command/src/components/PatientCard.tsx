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
  const [isExpanded, setIsExpanded] = useState(false);

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
    <div
      className="w-full cursor-pointer rounded-2xl text-left transition-all duration-200"
      onClick={() => setIsExpanded((v) => !v)}
      style={{
        background: isSelected ? "#eff6ff" : "#ffffff",
        borderTop: `1px solid ${isSelected ? "rgba(37,99,235,0.25)" : "#e2e8f0"}`,
        borderRight: `1px solid ${isSelected ? "rgba(37,99,235,0.25)" : "#e2e8f0"}`,
        borderBottom: `1px solid ${isSelected ? "rgba(37,99,235,0.25)" : "#e2e8f0"}`,
        borderLeft: `3px solid ${meta.triageColor}`,
        boxShadow: isSelected ? "0 2px 8px rgba(37,99,235,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Compact rows (always visible) ── */}
      <div className="px-4 py-3">
        {/* Row 1: name + priority */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold leading-snug" style={{ color: "var(--text)" }}>
              {patient.display_name}
            </span>
            <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
              {patient.patient_id}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {alertCount > 0 && (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: "#E24B4A" }}
              >
                {alertCount}
              </span>
            )}
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: meta.statusColor + "20", color: meta.statusColor }}
            >
              {meta.statusLabel}
            </span>
          </div>
        </div>

        {/* Row 2: triage badge + BPM + wait + chevron */}
        <div className="flex items-center gap-2.5">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ background: meta.triageColor + "25", color: meta.triageColor }}
          >
            T{meta.triageNum}
          </span>
          <span
            className="tabular-nums font-black"
            style={{ fontSize: "1.1rem", color: hrDisplay.muted ? "var(--text-dim)" : "var(--amber)" }}
          >
            {hrDisplay.value}
            <span className="text-xs font-medium ml-0.5" style={{ color: "var(--text-muted)" }}>bpm</span>
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
          <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            ⏱ {formatElapsed(patient.wait_minutes, extraSeconds)}
          </span>
          <span className="ml-auto text-xs" style={{ color: "var(--text-dim)" }}>
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </div>

      {/* ── Expanded detail section ── */}
      {isExpanded && (
        <div
          className="px-4 pb-4"
          onClick={(e) => e.stopPropagation()}
          style={{ borderTop: "1px solid #e2e8f0" }}
        >
          {/* Chief complaint */}
          <p className="mt-2.5 text-sm" style={{ color: "var(--text-2)" }}>{patient.chief_complaint}</p>

          {/* HR + sparkline */}
          <div className="mt-2 flex items-center gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: "var(--text-muted)" }}>
                Heart Rate
              </p>
              <div className="flex items-baseline gap-1">
                <span
                  className="tabular-nums font-black leading-none"
                  style={{ fontSize: "1.8rem", color: hrDisplay.muted ? "var(--text-dim)" : "var(--amber)", letterSpacing: "-0.02em" }}
                >
                  {hrDisplay.value}
                </span>
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>bpm</span>
              </div>
              {confLabel && (
                <p className="mt-0.5 text-[10px]" style={{ color: hrDisplay.muted ? "var(--text-dim)" : "var(--text-muted)" }}>
                  {confLabel}
                </p>
              )}
            </div>
            {hrData.length > 1 && (
              <div className="h-10 min-w-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hrData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                    <Line
                      type="monotone"
                      dataKey="heart_rate_bpm"
                      stroke={hrDisplay.muted ? "rgba(0,0,0,0.15)" : "#f59e0b"}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* AI reasoning */}
          {patient.triage_reasoning && (
            <p className="mt-1.5 line-clamp-2 text-[11px] italic" style={{ color: "var(--text-dim)" }}>
              <span className="not-italic font-semibold" style={{ color: "var(--accent)" }}>AI · </span>
              {patient.triage_reasoning}
            </p>
          )}

          {/* View full details button */}
          <button
            type="button"
            onClick={() => onSelect(patient)}
            className="mt-3 w-full rounded-xl py-2 text-sm font-bold transition-all"
            style={{
              background: "rgba(37,99,235,0.08)",
              color: "var(--accent)",
              border: "1px solid rgba(37,99,235,0.20)",
            }}
          >
            View Full Details →
          </button>
        </div>
      )}
    </div>
  );
}

