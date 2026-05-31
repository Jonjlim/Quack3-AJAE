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
  RESUSCITATION: { triageNum: 1, triageColor: "#dc2626", statusColor: "#dc2626", statusLabel: "URGENT" },
  EMERGENT:      { triageNum: 2, triageColor: "#ea580c", statusColor: "#dc2626", statusLabel: "URGENT" },
  URGENT:        { triageNum: 3, triageColor: "#d97706", statusColor: "#d97706", statusLabel: "WATCH"  },
  LESS_URGENT:   { triageNum: 4, triageColor: "#15803d", statusColor: "#15803d", statusLabel: "STABLE" },
  NON_URGENT:    { triageNum: 5, triageColor: "#6b7280", statusColor: "#15803d", statusLabel: "STABLE" },
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
      className={`w-full border border-l-2 bg-[var(--surface)] text-left transition-colors ${
        isSelected
          ? "border-[var(--text-muted)] bg-[var(--surface-2)]"
          : "border-[var(--border-subtle)] hover:bg-[var(--surface-2)]"
      }`}
      style={{ borderLeftColor: meta.triageColor, borderLeftWidth: 2 }}
    >
      <div className="relative px-2 py-1.5">
        {showCamera && (
          <div className="absolute right-2 top-1.5 h-12 w-[4rem] overflow-hidden border border-[var(--border)] bg-black">
            <RemoteVideo
              track={patientVideo!.mediaStreamTrack}
              className="h-full w-full"
              feedRole="thumbnail"
            />
          </div>
        )}

        <div className={showCamera ? "pr-[4.5rem]" : undefined}>
          <div className="mb-0.5 flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold leading-snug text-[var(--text)]">
                {patient.display_name}
              </span>
              <span className="telemetry-value block truncate text-[9px] text-[var(--text-muted)]">
                {patient.patient_id}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {alertCount > 0 && (
                <span className="telemetry-value flex h-3.5 min-w-3.5 items-center justify-center bg-[var(--status-critical)] px-0.5 text-[9px] font-bold text-white">
                  {alertCount}
                </span>
              )}
              <span
                className="border px-1 py-px text-[9px] font-semibold uppercase tracking-wide"
                style={{
                  borderColor: meta.statusColor,
                  color: meta.statusColor,
                  background: "transparent",
                }}
              >
                {meta.statusLabel}
              </span>
            </div>
          </div>

          <p className="mb-1 line-clamp-1 text-[10px] text-[var(--text-2)]">
            {patient.chief_complaint}
          </p>

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
            <span
              className="telemetry-value border px-1 py-px text-[9px] font-bold"
              style={{ borderColor: meta.triageColor, color: meta.triageColor }}
            >
              T{meta.triageNum}
            </span>
            <span
              className={`telemetry-value text-sm font-medium ${
                hrDisplay.muted ? "text-[var(--text-dim)]" : "text-[var(--status-alert)]"
              }`}
            >
              {hrDisplay.value}
              <span className="ml-0.5 text-[9px] font-normal text-[var(--text-dim)]">BPM</span>
            </span>
            <span className="telemetry-value text-[9px] text-[var(--text-muted)]">
              {formatElapsed(patient.wait_minutes, extraSeconds)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
