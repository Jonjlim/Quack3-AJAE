import { useEffect } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AcuityLevel, BiometricReading, PatientRecord } from "@shared/types/telemetry";

interface BiometricModalProps {
  patient: PatientRecord | null;
  hrHistory: Record<string, BiometricReading[]>;
  latestBiometric: BiometricReading | null;
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

export function BiometricModal({
  patient,
  hrHistory,
  latestBiometric,
  onClose,
  onEscalate,
  onMarkStable,
}: BiometricModalProps) {
  useEffect(() => {
    if (!patient) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [patient, onClose]);

  if (!patient) return null;

  const history = hrHistory[patient.patient_id] ?? [];
  const latest =
    latestBiometric?.patient_id === patient.patient_id
      ? latestBiometric
      : patient.last_biometric;

  const hrData = history.length > 0 ? history : (latest ? [latest] : []);
  const baselineHr = hrData.length > 0 ? hrData[0].heart_rate_bpm : null;
  const acuityColor = ACUITY_COLOR[patient.acuity] ?? "#639922";
  const triageNum = ACUITY_TRIAGE[patient.acuity] ?? 5;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.78)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl"
        style={{ background: "#0d1526", border: `2px solid ${acuityColor}35` }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4"
          style={{ background: "#111d33", borderBottom: "1px solid #1e293b" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">{patient.display_name}</span>
              <span
                className="rounded px-2 py-0.5 text-xs font-bold"
                style={{ background: acuityColor + "25", color: acuityColor }}
              >
                T{triageNum} · {patient.acuity.replace("_", " ")}
              </span>
              <span className="text-xs font-semibold uppercase" style={{ color: acuityColor }}>
                {patient.status}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-400">{patient.chief_complaint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-700 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5">
          {/* Vitals */}
          <div className="grid grid-cols-3 gap-3">
            <VitalCard
              label="Heart Rate"
              value={latest?.heart_rate_bpm != null ? String(latest.heart_rate_bpm) : "—"}
              unit="bpm"
              color={acuityColor}
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

          {/* HR trend graph */}
          {hrData.length > 1 && (
            <div>
              <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">
                HR Trend — last {hrData.length} readings
              </p>
              <div style={{ height: 130 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={hrData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                    <XAxis dataKey="recorded_at" hide />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "#475569", fontSize: 10 }}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid #334155",
                        borderRadius: "6px",
                        fontSize: "12px",
                      }}
                      formatter={(v: unknown) => [`${v} bpm`, "HR"]}
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
                    <Line
                      type="monotone"
                      dataKey="heart_rate_bpm"
                      stroke={acuityColor}
                      strokeWidth={2}
                      dot={{ fill: acuityColor, r: 2.5 }}
                      activeDot={{ r: 4 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Info rows */}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Queue Position" value={`#${patient.queue_position}`} />
            <InfoRow
              label="Camera"
              value={patient.camera_enabled ? "Opted in ✓" : "Opted out"}
            />
          </div>

          {/* Camera feed placeholder */}
          {patient.camera_enabled && (
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ background: "#080f1c", border: "1px solid #1e293b", height: 96 }}
            >
              <span className="text-xs text-slate-600">
                LiveKit patient feed — pending integration
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { onEscalate(patient.patient_id); onClose(); }}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "#E24B4A18",
                color: "#E24B4A",
                border: "1px solid #E24B4A45",
              }}
            >
              Escalate
            </button>
            <button
              type="button"
              onClick={() => { onMarkStable(patient.patient_id); onClose(); }}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "#63992218",
                color: "#639922",
                border: "1px solid #63992245",
              }}
            >
              Mark Stable
            </button>
          </div>
        </div>
      </div>
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
      className="rounded-lg p-3"
      style={{ background: "#080f1c", border: "1px solid #1e293b" }}
    >
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-slate-500">{unit}</span>}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded p-2.5"
      style={{ background: "#080f1c", border: "1px solid #1e293b" }}
    >
      <p className="text-xs text-slate-600">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
