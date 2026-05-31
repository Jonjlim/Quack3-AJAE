import { useEffect, useState } from "react";
import type { AcuityLevel, BiometricReading, PatientRecord } from "@shared/types/telemetry";
import type { RemoteVideoTrack } from "../hooks/useLiveKitRoom";
import { RemoteVideo } from "./RemoteVideo";

interface PatientCardProps {
  patient: PatientRecord;
  isSelected: boolean;
  onSelect: (patient: PatientRecord) => void;
  alertCount: number;
  patientVideo: RemoteVideoTrack | null;
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

function formatHrDisplay(bio: BiometricReading | null | undefined): { value: string; muted: boolean } {
  if (bio?.heart_rate_bpm == null) {
    return { value: "—", muted: true };
  }
  const muted = bio.confidence < 0.5 || bio.measurement_status === "unreliable";
  return { value: String(Math.round(bio.heart_rate_bpm)), muted };
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

export function PatientCard({
  patient,
  isSelected,
  onSelect,
  alertCount,
  patientVideo,
}: PatientCardProps) {
  const [extraSeconds, setExtraSeconds] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setExtraSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const meta = ACUITY_META[patient.acuity] ?? ACUITY_META.NON_URGENT;
  const hrDisplay = formatHrDisplay(patient.last_biometric);
  const showCamera = patientVideo != null;

  return (
    <button
      type="button"
      onClick={() => onSelect(patient)}
      className="w-full rounded-2xl text-left transition-all duration-200"
      style={{
        background: isSelected ? "#eff6ff" : "#ffffff",
        borderTop: `1px solid ${isSelected ? "rgba(37,99,235,0.25)" : "#e2e8f0"}`,
        borderRight: `1px solid ${isSelected ? "rgba(37,99,235,0.25)" : "#e2e8f0"}`,
        borderBottom: `1px solid ${isSelected ? "rgba(37,99,235,0.25)" : "#e2e8f0"}`,
        borderLeft: `3px solid ${meta.triageColor}`,
        boxShadow: isSelected ? "0 2px 8px rgba(37,99,235,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div className="relative px-3 py-2.5">
        {showCamera && (
          <div
            className="absolute right-3 top-2.5 h-14 w-[4.5rem] overflow-hidden rounded-lg"
            style={{ background: "#0f172a", border: "1px solid #e2e8f0" }}
          >
            <RemoteVideo
              track={patientVideo!.mediaStreamTrack}
              className="h-full w-full"
              feedRole="thumbnail"
            />
          </div>
        )}

        <div className={showCamera ? "pr-[5.25rem]" : undefined}>
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold leading-snug" style={{ color: "var(--text)" }}>
                {patient.display_name}
              </span>
              <span className="block truncate font-mono text-[10px] tracking-wide" style={{ color: "var(--text-muted)" }}>
                {patient.patient_id}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {alertCount > 0 && (
                <span
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: "#E24B4A" }}
                >
                  {alertCount}
                </span>
              )}
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: meta.statusColor + "20", color: meta.statusColor }}
              >
                {meta.statusLabel}
              </span>
            </div>
          </div>

          <p className="mb-1.5 line-clamp-1 text-[11px]" style={{ color: "var(--text-2)" }}>
            {patient.chief_complaint}
          </p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: meta.triageColor + "25", color: meta.triageColor }}
            >
              T{meta.triageNum}
            </span>
            <span
              className="shrink-0 tabular-nums font-black"
              style={{ fontSize: "1rem", color: hrDisplay.muted ? "var(--text-dim)" : "var(--amber)" }}
            >
              {hrDisplay.value}
              <span className="ml-0.5 text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>bpm</span>
            </span>
            <span className="shrink-0 text-[10px] whitespace-nowrap font-medium" style={{ color: "var(--text-muted)" }}>
              ⏱ {formatElapsed(patient.wait_minutes, extraSeconds)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
