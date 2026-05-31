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
}

const ACUITY_COLOR: Record<AcuityLevel, string> = {
  RESUSCITATION: "#E24B4A",
  EMERGENT: "#E24B4A",
  URGENT: "#BA7517",
  LESS_URGENT: "#639922",
  NON_URGENT: "#639922",
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
    return { label: "Reliable", color: "#639922" };
  }
  if (bio.measurement_status === "estimated" || bio.confidence >= 0.5) {
    return { label: "Estimated", color: "#BA7517" };
  }
  return { label: "Low confidence", color: "#64748b" };
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
  const acuityColor = ACUITY_COLOR[patient.acuity] ?? "#639922";
  const triageNum = ACUITY_TRIAGE[patient.acuity] ?? 5;
  const badge = confidenceBadge(latest);
  const hrMuted = (latest?.confidence ?? 0) < 0.5 || latest?.measurement_status === "unreliable";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.50)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl"
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          boxShadow: "0 25px 60px rgba(0,0,0,0.20), 0 8px 20px rgba(0,0,0,0.08)",
        }}
      >
        <div
          className="flex flex-shrink-0 items-start justify-between px-5 py-5"
          style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}
        >
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl font-black" style={{ color: "var(--text)" }}>{patient.display_name}</span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                style={{ background: acuityColor + "18", color: acuityColor }}
              >
                T{triageNum}
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>{patient.chief_complaint}</p>
            <p className="mt-1 font-mono text-xs tracking-wide" style={{ color: "var(--text-muted)" }}>
              {patient.patient_id}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {patient.acuity.replace(/_/g, " ")} · {patient.status}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm transition-all"
            style={{ color: "var(--text-muted)", background: "#f1f5f9" }}
          >
            ✕
          </button>
        </div>

        {patientVideo && (
          <div
            className="flex flex-shrink-0 items-center justify-center bg-slate-950"
            style={{ borderBottom: "1px solid #e2e8f0" }}
          >
            <RemoteVideo
              track={patientVideo.mediaStreamTrack}
              className="aspect-video max-h-[min(40vh,420px)] w-full"
              label={patient.display_name}
              objectFit="contain"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {badge && (
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: badge.color + "14", color: badge.color, border: `1px solid ${badge.color}28` }}
              >
                Vitals · {badge.label}
              </span>
              {latest && latest.confidence > 0 && (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {Math.round(latest.confidence * 100)}% confidence
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <VitalCard
              label="Heart Rate"
              value={hrVitalDisplay(latest)}
              unit="bpm"
              color={hrMuted ? "#64748b" : acuityColor}
            />
            <VitalCard
              label="Resp. Rate"
              value={
                latest?.respiratory_rate_bpm != null ? String(latest.respiratory_rate_bpm) : "—"
              }
              unit="br/min"
              color="#60a5fa"
            />
            <VitalCard
              label="Waiting"
              value={formatWait(patient.wait_minutes)}
              unit=""
              color="#94a3b8"
            />
          </div>

          {chartData.length > 1 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                HR Trend — last {chartData.length} readings (shaded = CI)
              </p>
              <div style={{ height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                    <XAxis dataKey="recorded_at" hide />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#94a3b8", fontSize: 10 }}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(255,255,255,0.96)",
                        border: "1px solid rgba(0,0,0,0.10)",
                        borderRadius: "8px",
                        fontSize: "12px",
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
                        stroke="#E24B4A"
                        strokeDasharray="4 2"
                        strokeOpacity={0.6}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="hr_high"
                      stroke="none"
                      fill={acuityColor}
                      fillOpacity={0.15}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="hr_low"
                      stroke="none"
                      fill="#ffffff"
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="heart_rate_bpm"
                      stroke={hrMuted ? "#64748b" : acuityColor}
                      strokeWidth={2}
                      dot={{ fill: hrMuted ? "#64748b" : acuityColor, r: 2.5 }}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Queue Position" value={`#${patient.queue_position}`} />
            <InfoRow
              label="Camera"
              value={patientVideo ? "Live — patient opted in" : "Off — patient controls in app"}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setShowCasefile(true)}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "#3b82f618",
                color: "#60a5fa",
                border: "1px solid #3b82f645",
              }}
            >
              Case File
            </button>
            <button
              type="button"
              onClick={() => {
                onEscalate(patient.patient_id);
                onClose();
              }}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "rgba(220,38,38,0.08)",
                color: "var(--critical)",
                border: "1px solid rgba(220,38,38,0.22)",
              }}
            >
              Escalate
            </button>
            <button
              type="button"
              onClick={() => {
                onMarkStable(patient.patient_id);
                onClose();
              }}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "rgba(22,163,74,0.08)",
                color: "#15803d",
                border: "1px solid rgba(22,163,74,0.22)",
              }}
            >
              Mark Stable
            </button>
          </div>
        </div>
      </div>

      {/* Casefile report modal */}
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
    <div
      className="rounded-xl p-4"
      style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-2xl font-black leading-none" style={{ color }}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium" style={{ color: "var(--text-muted)" }}>{unit}</span>}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded p-2.5"
      style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
    >
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--text)" }}>{value}</p>
    </div>
  );
}
