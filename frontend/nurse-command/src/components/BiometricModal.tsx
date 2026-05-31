import { useEffect, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AcuityLevel, BiometricReading, PatientRecord } from "@shared/types/telemetry";
import type { RemoteVideoTrack } from "../hooks/useLiveKitRoom";
import { RemoteVideo } from "./RemoteVideo";
import { CasefileReportModal } from "./CasefileReportModal";

interface BiometricModalProps {
  patient: PatientRecord | null;
  hrHistory: Record<string, BiometricReading[]>;
  latestBiometric: BiometricReading | null;
  patientVideo: RemoteVideoTrack | null;
  onClose: () => void;
  onEscalate: (patientId: string) => void;
  onMarkStable: (patientId: string) => void;
  onRemove: (patientId: string) => void;
}

const ACUITY_COLOR: Record<AcuityLevel, string> = {
  RESUSCITATION: "#dc2626",
  EMERGENT: "#dc2626",
  URGENT: "#d97706",
  LESS_URGENT: "#15803d",
  NON_URGENT: "#15803d",
};

const ACUITY_TRIAGE: Record<AcuityLevel, number> = {
  RESUSCITATION: 1,
  EMERGENT: 2,
  URGENT: 3,
  LESS_URGENT: 4,
  NON_URGENT: 5,
};

function formatWait(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function confidenceBadge(bio: BiometricReading | null | undefined): {
  label: string;
  color: string;
} | null {
  if (!bio || bio.confidence <= 0) return null;
  if (bio.measurement_status === "reliable" || bio.confidence >= 0.65) {
    return { label: "Reliable", color: "#15803d" };
  }
  if (bio.measurement_status === "estimated" || bio.confidence >= 0.5) {
    return { label: "Estimated", color: "#d97706" };
  }
  return { label: "Low confidence", color: "#6b7280" };
}

function hrVitalDisplay(bio: BiometricReading | null | undefined): string {
  if (bio?.heart_rate_bpm == null) return "—";
  const hr = Math.round(bio.heart_rate_bpm);
  if (bio.heart_rate_bpm_low != null && bio.heart_rate_bpm_high != null) {
    return `${hr} (${Math.round(bio.heart_rate_bpm_low)}–${Math.round(bio.heart_rate_bpm_high)})`;
  }
  return String(hr);
}

export function BiometricModal({
  patient,
  hrHistory,
  latestBiometric,
  patientVideo,
  onClose,
  onEscalate,
  onMarkStable,
  onRemove,
}: BiometricModalProps) {
  const [showCasefile, setShowCasefile] = useState(false);

  useEffect(() => {
    if (!patient) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [patient, onClose]);

  if (!patient) return null;

  const history = hrHistory[patient.patient_id] ?? [];
  const latest =
    latestBiometric?.patient_id === patient.patient_id
      ? latestBiometric
      : patient.last_biometric;

  const hrData = history.length > 0 ? history : latest ? [latest] : [];
  const chartData = hrData.map((r) => ({
    ...r,
    hr_low: r.heart_rate_bpm_low ?? r.heart_rate_bpm,
    hr_high: r.heart_rate_bpm_high ?? r.heart_rate_bpm,
    ci_band: r.heart_rate_bpm_high != null && r.heart_rate_bpm_low != null
      ? r.heart_rate_bpm_high - r.heart_rate_bpm_low
      : 0,
  }));
  const baselineHr = hrData.length > 0 ? hrData[0].heart_rate_bpm : null;
  const acuityColor = ACUITY_COLOR[patient.acuity] ?? "#15803d";
  const triageNum = ACUITY_TRIAGE[patient.acuity] ?? 5;
  const badge = confidenceBadge(latest);
  const hrMuted = (latest?.confidence ?? 0) < 0.5 || latest?.measurement_status === "unreliable";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden">
        <div className="panel-header flex flex-shrink-0 items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text)]">{patient.display_name}</span>
              <span
                className="telemetry-value border px-1 py-px text-[10px] font-bold"
                style={{ borderColor: acuityColor, color: acuityColor }}
              >
                T{triageNum}
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-2)]">{patient.chief_complaint}</p>
            <p className="telemetry-value mt-0.5 text-[10px] text-[var(--text-muted)]">
              {patient.patient_id}
            </p>
            <p className="telemetry-label mt-0.5 text-[var(--text-dim)]">
              {patient.acuity.replace(/_/g, " ")} · {patient.status}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-muted)] hover:bg-[var(--surface)]"
          >
            ✕
          </button>
        </div>

        {patientVideo && (
          <div className="flex flex-shrink-0 items-center justify-center border-b border-[var(--border)] bg-black">
            <RemoteVideo
              track={patientVideo.mediaStreamTrack}
              className="aspect-video max-h-[min(36vh,380px)] w-full"
              label={patient.display_name}
              objectFit="contain"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {badge && (
            <div className="flex items-center gap-2">
              <span
                className="border px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest"
                style={{ borderColor: badge.color, color: badge.color }}
              >
                Vitals · {badge.label}
              </span>
              {latest && latest.confidence > 0 && (
                <span className="telemetry-value text-[9px] text-[var(--text-dim)]">
                  {Math.round(latest.confidence * 100)}% conf
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-px bg-[var(--border-subtle)]">
            <VitalCard
              label="Heart Rate"
              value={hrVitalDisplay(latest)}
              unit="BPM"
              color={hrMuted ? "#6b7280" : acuityColor}
            />
            <VitalCard
              label="Resp. Rate"
              value={
                latest?.respiratory_rate_bpm != null ? String(latest.respiratory_rate_bpm) : "—"
              }
              unit="BR/MIN"
              color="#374151"
            />
            <VitalCard
              label="Waiting"
              value={formatWait(patient.wait_minutes)}
              unit=""
              color="#6b7280"
            />
          </div>

          {chartData.length > 1 && (
            <div className="border border-[var(--border-subtle)] bg-[var(--surface)] p-2">
              <p className="telemetry-label mb-1">
                HR Trend — {chartData.length} readings
              </p>
              <div style={{ height: 110 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <XAxis dataKey="recorded_at" hide />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#9ca3af", fontSize: 9, fontFamily: "ui-monospace, monospace" }}
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#fafafa",
                        border: "1px solid #b8bcc4",
                        borderRadius: "0",
                        fontSize: "11px",
                        fontFamily: "ui-monospace, monospace",
                        color: "#111827",
                      }}
                      formatter={(v: unknown, name: string) => {
                        if (name === "heart_rate_bpm") return [`${v} bpm`, "HR"];
                        if (name === "hr_low") return [`${v} bpm`, "CI low"];
                        if (name === "hr_high") return [`${v} bpm`, "CI high"];
                        return [String(v), name];
                      }}
                      labelFormatter={() => ""}
                    />
                    {baselineHr != null && (
                      <ReferenceLine
                        y={baselineHr}
                        stroke="#dc2626"
                        strokeDasharray="3 2"
                        strokeOpacity={0.5}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="hr_high"
                      stroke="none"
                      fill={acuityColor}
                      fillOpacity={0.12}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="hr_low"
                      stroke="none"
                      fill="#fafafa"
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="heart_rate_bpm"
                      stroke={hrMuted ? "#6b7280" : acuityColor}
                      strokeWidth={1.5}
                      dot={{ fill: hrMuted ? "#6b7280" : acuityColor, r: 2 }}
                      activeDot={{ r: 3 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)]">
            <InfoRow label="Queue Position" value={`#${patient.queue_position}`} mono />
            <InfoRow
              label="Camera"
              value={patientVideo ? "Live — patient opted in" : "Off — patient controls in app"}
            />
          </div>

          <div className="flex gap-px bg-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setShowCasefile(true)}
              className="flex-1 border border-[var(--border)] bg-[var(--surface-2)] py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-2)] hover:bg-[var(--surface)]"
            >
              Case File
            </button>
            <button
              type="button"
              onClick={() => {
                onEscalate(patient.patient_id);
                onClose();
              }}
              className="flex-1 border border-[var(--status-critical)] bg-red-50 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--status-critical)] hover:bg-red-100"
            >
              Escalate
            </button>
            <button
              type="button"
              onClick={() => {
                onMarkStable(patient.patient_id);
                onClose();
              }}
              className="flex-1 border border-[var(--status-stable)] bg-green-50 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--status-stable)] hover:bg-green-100"
            >
              Mark Stable
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Remove ${patient.display_name} from the queue? They will need to check in again to rejoin.`,
                )
              ) {
                onRemove(patient.patient_id);
                onClose();
              }
            }}
            className="w-full border border-[var(--border)] bg-[var(--surface-2)] py-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] hover:bg-[var(--surface)]"
          >
            Remove from queue
          </button>
        </div>
      </div>

      {showCasefile && (
        <CasefileReportModal
          patientId={patient.patient_id}
          patientName={patient.display_name}
          onClose={() => setShowCasefile(false)}
        />
      )}
    </div>
  );
}

function VitalCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--surface)] p-2">
      <p className="telemetry-label mb-0.5">{label}</p>
      <p className="telemetry-value text-lg font-medium leading-none" style={{ color }}>
        {value}
        {unit && (
          <span className="ml-1 text-[9px] font-normal text-[var(--text-dim)]">{unit}</span>
        )}
      </p>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-[var(--surface)] p-2">
      <p className="telemetry-label">{label}</p>
      <p className={`mt-0.5 text-[11px] text-[var(--text)] ${mono ? "telemetry-value" : ""}`}>
        {value}
      </p>
    </div>
  );
}
