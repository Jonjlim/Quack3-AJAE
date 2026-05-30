import { useState } from "react";
import type { AcuityLevel } from "@shared/types/telemetry";
import type { CheckInData } from "../hooks/useTriageSocket";

interface CheckInPageProps {
  onSubmit: (data: CheckInData) => { display_name: string };
  onBack: () => void;
}

const ACUITY_OPTIONS: {
  level: AcuityLevel;
  triageNum: number;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    level: "RESUSCITATION",
    triageNum: 1,
    label: "Resuscitation",
    description: "Immediate life threat",
    color: "#E24B4A",
  },
  {
    level: "EMERGENT",
    triageNum: 2,
    label: "Emergent",
    description: "May deteriorate rapidly",
    color: "#f97316",
  },
  {
    level: "URGENT",
    triageNum: 3,
    label: "Urgent",
    description: "Stable, needs prompt care",
    color: "#eab308",
  },
  {
    level: "LESS_URGENT",
    triageNum: 4,
    label: "Less Urgent",
    description: "Stable, can wait",
    color: "#22c55e",
  },
  {
    level: "NON_URGENT",
    triageNum: 5,
    label: "Non-Urgent",
    description: "Minor complaint",
    color: "#3b82f6",
  },
];

export function CheckInPage({ onSubmit, onBack }: CheckInPageProps) {
  const [complaint, setComplaint] = useState("");
  const [acuity, setAcuity] = useState<AcuityLevel | null>(null);
  const [cameraOptIn, setCameraOptIn] = useState(false);
  const [confirmed, setConfirmed] = useState<{ display_name: string; complaint: string } | null>(null);
  const [errors, setErrors] = useState<{ complaint?: string; acuity?: string }>({});

  function validate(): boolean {
    const e: typeof errors = {};
    if (!complaint.trim()) e.complaint = "Chief complaint is required.";
    if (!acuity) e.acuity = "Select a triage level.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (!validate() || !acuity) return;
    const result = onSubmit({ complaint: complaint.trim(), acuity, cameraOptIn });
    setConfirmed({ display_name: result.display_name, complaint: complaint.trim() });
  }

  function handleAnother() {
    setComplaint("");
    setAcuity(null);
    setCameraOptIn(false);
    setConfirmed(null);
    setErrors({});
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-white">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center gap-4 border-b border-slate-800 px-5 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          ← Dashboard
        </button>
        <div className="h-5 w-px bg-slate-700" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
            ER-OVERWATCH
          </p>
          <h1 className="text-lg font-bold leading-tight">Patient Check-In</h1>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto p-6">
        <div className="w-full max-w-xl">
          {confirmed ? (
            /* Success state */
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: "#0d1a0f", border: "2px solid #63992260" }}
            >
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                style={{ background: "#63992225" }}
              >
                ✓
              </div>
              <h2 className="mb-1 text-xl font-bold text-white">Patient Checked In</h2>
              <p className="mb-1 text-3xl font-bold" style={{ color: "#639922" }}>
                {confirmed.display_name}
              </p>
              <p className="mb-6 text-sm text-slate-400">{confirmed.complaint}</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleAnother}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #334155" }}
                >
                  Check In Another
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{
                    background: "#63992220",
                    color: "#639922",
                    border: "1px solid #63992250",
                  }}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            /* Form */
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid #1e293b" }}
            >
              {/* Form header */}
              <div
                className="px-6 py-4"
                style={{ background: "#111d33", borderBottom: "1px solid #1e293b" }}
              >
                <h2 className="font-semibold text-white">New Patient Intake</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Complete all required fields. A queue ID will be auto-assigned.
                </p>
              </div>

              <div className="space-y-6 bg-slate-900 p-6">
                {/* Chief complaint */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Chief Complaint <span style={{ color: "#E24B4A" }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={complaint}
                    onChange={(e) => {
                      setComplaint(e.target.value);
                      if (errors.complaint) setErrors((p) => ({ ...p, complaint: undefined }));
                    }}
                    placeholder="Describe the patient's primary complaint…"
                    className="w-full resize-none rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-colors focus:ring-1"
                    style={{
                      background: "#0d1526",
                      border: `1px solid ${errors.complaint ? "#E24B4A" : "#1e293b"}`,
                    }}
                  />
                  {errors.complaint && (
                    <p className="mt-1 text-xs" style={{ color: "#E24B4A" }}>
                      {errors.complaint}
                    </p>
                  )}
                </div>

                {/* Triage level */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-300">
                    Triage Level <span style={{ color: "#E24B4A" }}>*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {ACUITY_OPTIONS.map((opt) => {
                      const selected = acuity === opt.level;
                      return (
                        <button
                          key={opt.level}
                          type="button"
                          onClick={() => {
                            setAcuity(opt.level);
                            if (errors.acuity) setErrors((p) => ({ ...p, acuity: undefined }));
                          }}
                          className="rounded-lg p-3 text-center transition-all"
                          style={{
                            background: selected ? opt.color + "28" : "#0d1526",
                            border: `2px solid ${selected ? opt.color : "#1e293b"}`,
                          }}
                        >
                          <p
                            className="text-lg font-bold"
                            style={{ color: selected ? opt.color : "#475569" }}
                          >
                            T{opt.triageNum}
                          </p>
                          <p
                            className="mt-0.5 text-xs font-semibold leading-tight"
                            style={{ color: selected ? opt.color : "#64748b" }}
                          >
                            {opt.label}
                          </p>
                          <p className="mt-1 text-xs leading-tight text-slate-600">
                            {opt.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {errors.acuity && (
                    <p className="mt-1 text-xs" style={{ color: "#E24B4A" }}>
                      {errors.acuity}
                    </p>
                  )}
                </div>

                {/* Camera consent */}
                <div className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ background: "#0d1526", border: "1px solid #1e293b" }}
                >
                  <div>
                    <p className="text-sm font-medium text-white">Camera Monitoring</p>
                    <p className="text-xs text-slate-500">
                      Patient consents to remote biometric monitoring via camera
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cameraOptIn}
                    onClick={() => setCameraOptIn((v) => !v)}
                    className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors"
                    style={{ background: cameraOptIn ? "#3b82f6" : "#1e293b" }}
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                      style={{ left: cameraOptIn ? "calc(100% - 1.375rem)" : "2px" }}
                    />
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full rounded-lg py-3 text-sm font-bold transition-opacity hover:opacity-90"
                  style={{ background: "#1d4ed8", color: "white" }}
                >
                  Check In Patient →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
