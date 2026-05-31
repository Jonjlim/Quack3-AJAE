import { useEffect, useMemo, useState } from "react";
import type { AcuityLevel } from "@shared/types/telemetry";
import type { CheckInData, CheckInResult } from "../hooks/useTriageSocket";
import {
  ALERT_SENSITIVITY,
  COMPLAINT_TILES,
  CV_IGNORE_MAP,
  CV_TRACK_MAP,
  SYMPTOMS,
  UNIVERSAL_FLAGS,
  type Symptom,
} from "../mock/mockData";

interface CheckInTabProps {
  onSubmit: (data: CheckInData) => Promise<CheckInResult>;
}

const TRIAGE_CONFIG: Record<
  AcuityLevel,
  { num: number; label: string; desc: string; color: string; dimBg: string; dimText: string }
> = {
  RESUSCITATION: { num: 1, label: "Resuscitation", desc: "Immediate life threat",  color: "#E24B4A", dimBg: "#fef2f2", dimText: "#b91c1c" },
  EMERGENT:      { num: 2, label: "Emergent",      desc: "May deteriorate rapidly", color: "#f97316", dimBg: "#fff7ed", dimText: "#c2410c" },
  URGENT:        { num: 3, label: "Urgent",        desc: "Needs prompt care",       color: "#eab308", dimBg: "#fefce8", dimText: "#a16207" },
  LESS_URGENT:   { num: 4, label: "Less urgent",   desc: "Stable, can wait",        color: "#22c55e", dimBg: "#f0fdf4", dimText: "#15803d" },
  NON_URGENT:    { num: 5, label: "Non-urgent",    desc: "Minor complaint",          color: "#3b82f6", dimBg: "#eff6ff", dimText: "#1d4ed8" },
};

const ACUITY_ORDER: AcuityLevel[] = ["RESUSCITATION", "EMERGENT", "URGENT", "LESS_URGENT", "NON_URGENT"];

const ACUITY_SEVERITY: Record<AcuityLevel, number> = {
  RESUSCITATION: 0, EMERGENT: 1, URGENT: 2, LESS_URGENT: 3, NON_URGENT: 4,
};

function mostCriticalAcuity(labels: string[]): AcuityLevel | null {
  let best: AcuityLevel | null = null;
  let bestScore = 5;
  for (const label of labels) {
    const tile = COMPLAINT_TILES.find((t) => t.label === label);
    if (tile?.suggestedAcuity) {
      const score = ACUITY_SEVERITY[tile.suggestedAcuity];
      if (score < bestScore) { best = tile.suggestedAcuity; bestScore = score; }
    }
  }
  return best;
}

function currentTimeStr() {
  return new Date().toTimeString().slice(0, 5);
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-bold uppercase tracking-wider" style={{ color: "#1e293b" }}>
      {children}
    </h2>
  );
}

function Divider() {
  return <div className="my-5" style={{ borderTop: "1.5px solid #cbd5e1" }} />;
}

export function CheckInTab({ onSubmit }: CheckInTabProps) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"Male" | "Female" | "Non-binary" | "">("");
  const [arrivalTime, setArrivalTime] = useState(currentTimeStr);

  const [selectedComplaints, setSelectedComplaints] = useState<Set<string>>(new Set());
  const [otherDetail, setOtherDetail] = useState("");

  const [acuity, setAcuity] = useState<AcuityLevel | null>(null);
  const [acuityManual, setAcuityManual] = useState(false);

  const [symptoms, setSymptoms] = useState<Set<Symptom>>(new Set());
  const [otherSymptom, setOtherSymptom] = useState("");
  const [otherSymptomSelected, setOtherSymptomSelected] = useState(false);
  const [cameraOptIn, setCameraOptIn] = useState(false);

  const [errors, setErrors] = useState<{ complaint?: string; acuity?: string }>({});
  const [successCheckin, setSuccessCheckin] = useState<CheckInResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<
    { name: string; patient_id: string; complaint: string; time: string }[]
  >([]);

  const [showAiConfig, setShowAiConfig] = useState(false);

  useEffect(() => {
    if (!successCheckin) return;
    const id = setTimeout(() => setSuccessCheckin(null), 8000);
    return () => clearTimeout(id);
  }, [successCheckin]);

  function toggleComplaint(label: string) {
    setSelectedComplaints((prev) => {
      const next = new Set(prev);
      if (next.has(label)) { next.delete(label); } else { next.add(label); }
      if (!acuityManual) {
        const suggested = mostCriticalAcuity(Array.from(next));
        setAcuity(suggested);
      }
      if (errors.complaint) setErrors((p) => ({ ...p, complaint: undefined }));
      return next;
    });
  }

  function handleAcuitySelect(level: AcuityLevel) {
    setAcuity(level);
    setAcuityManual(true);
    if (errors.acuity) setErrors((p) => ({ ...p, acuity: undefined }));
  }

  function toggleSymptom(s: Symptom) {
    setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });
  }

  const cvInstructions = useMemo(() => {
    const labels = Array.from(selectedComplaints).filter((l) => l !== "Other");
    const track = [...new Set(labels.flatMap((l) => CV_TRACK_MAP[l] ?? []))];
    const ignore = [...new Set(labels.flatMap((l) => CV_IGNORE_MAP[l] ?? []))];
    const extra: string[] = [];
    if (symptoms.has("Bleeding")) extra.push("active bleeding visible");
    if (symptoms.has("Confusion")) extra.push("confusion behavior");
    if (symptoms.has("Shortness of breath") && !track.includes("labored breathing"))
      extra.push("labored breathing");
    return {
      track_priority: [...new Set([...track, ...extra])],
      ignore_flags: ignore.filter((f) => !track.includes(f)),
      alert_sensitivity: ALERT_SENSITIVITY[acuity ?? "URGENT"],
      universal_flags: UNIVERSAL_FLAGS,
    };
  }, [selectedComplaints, symptoms, acuity]);

  async function handleSubmit() {
    const complaints = Array.from(selectedComplaints);
    const hasOther = complaints.includes("Other");
    const namedComplaints = complaints.filter((c) => c !== "Other");
    const complaintStr = [
      ...namedComplaints,
      ...(hasOther && otherDetail.trim() ? [otherDetail.trim()] : []),
    ].join(", ");

    const e: typeof errors = {};
    if (!complaintStr) e.complaint = "Select at least one complaint.";
    if (!acuity) e.acuity = "Select a triage level.";
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await onSubmit({
        complaint: complaintStr,
        acuity: acuity!,
        cameraOptIn,
        displayName: name.trim() || undefined,
      });

      console.log("Patient check-in payload:", {
        patient: {
          patient_id: result.patient_id,
          name: name || null,
          age: age ? parseInt(age, 10) : null,
          sex: sex || null,
          complaint: complaintStr,
          symptoms: [...Array.from(symptoms), ...(otherSymptomSelected && otherSymptom.trim() ? [otherSymptom.trim()] : [])],
          triage_level: acuity,
          camera_opted_in: cameraOptIn,
          checked_in: new Date().toISOString(),
          arrival_time: arrivalTime,
        },
        cv_instructions: {
          patient_id: result.patient_id,
          complaint: complaintStr,
          triage_level: acuity,
          symptoms: [...Array.from(symptoms), ...(otherSymptomSelected && otherSymptom.trim() ? [otherSymptom.trim()] : [])],
          ...cvInstructions,
        },
      });

      setRecentCheckins((prev) => [
        {
          name: result.display_name,
          patient_id: result.patient_id,
          complaint: complaintStr,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 3),
      ]);
      setSuccessCheckin(result);
      setName(""); setAge(""); setSex(""); setArrivalTime(currentTimeStr());
      setSelectedComplaints(new Set()); setOtherDetail("");
      setAcuity(null); setAcuityManual(false);
      setSymptoms(new Set()); setOtherSymptomSelected(false); setOtherSymptom("");
      setCameraOptIn(false); setErrors({});
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  const submitColor = acuity ? TRIAGE_CONFIG[acuity].color : "#2563eb";
  const activeTriageColor = acuity ? TRIAGE_CONFIG[acuity].color : "#3b82f6";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">

      {/* Success toast */}
      {successCheckin && (
        <div className="mx-6 mt-4 flex items-center gap-4 rounded-xl px-5 py-4"
          style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <span className="text-2xl" style={{ color: "#22c55e" }}>&#10003;</span>
          <div className="flex-1">
            <p className="text-base font-semibold" style={{ color: "#15803d" }}>
              {successCheckin.display_name} checked in
            </p>
            <p className="font-mono text-sm tracking-wide" style={{ color: "#166534" }}>
              Patient ID: {successCheckin.patient_id}
            </p>
          </div>
          <button type="button" onClick={() => setSuccessCheckin(null)}
            className="text-lg" style={{ color: "#86efac" }}>
            &#10005;
          </button>
        </div>
      )}

      {submitError && (
        <p className="mx-6 mt-4 rounded-xl px-5 py-3 text-base"
          style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          {submitError}
        </p>
      )}

      {/* Two-panel layout */}
      <div className="flex flex-1 gap-6 overflow-hidden p-6">

        {/* ═══════ LEFT PANEL: Primary form ═══════ */}
        <div className="flex flex-[2] flex-col overflow-y-auto rounded-2xl p-6"
          style={{ background: "#ffffff", border: "1px solid #cbd5e1" }}>

          {/* Chief complaint */}
          <section>
            <SectionLabel>
              Chief complaint <span style={{ color: "#E24B4A" }}>*</span>
            </SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              {COMPLAINT_TILES.map((tile) => {
                const active = selectedComplaints.has(tile.label);
                return (
                  <button key={tile.label} type="button" onClick={() => toggleComplaint(tile.label)}
                    className="rounded-xl py-5 text-center text-lg font-medium transition-all"
                    style={{
                      background: active ? activeTriageColor + "12" : "#ffffff",
                      color: active ? activeTriageColor : "#1e293b",
                      border: `2px solid ${active ? activeTriageColor : "#cbd5e1"}`,
                      fontWeight: active ? 700 : 500,
                    }}>
                    {tile.label}
                  </button>
                );
              })}
            </div>
            {selectedComplaints.has("Other") && (
              <textarea rows={2} value={otherDetail}
                onChange={(e) => setOtherDetail(e.target.value)}
                placeholder="Describe the complaint..."
                className="mt-4 w-full resize-none rounded-xl px-4 py-3 text-base outline-none"
                style={{ background: "#ffffff", border: "1.5px solid #94a3b8", color: "#0f172a" }} />
            )}
            {errors.complaint && (
              <p className="mt-2 text-sm" style={{ color: "#E24B4A" }}>{errors.complaint}</p>
            )}
          </section>

          <Divider />

          {/* Triage level */}
          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <SectionLabel>
                Triage level <span style={{ color: "#E24B4A" }}>*</span>
              </SectionLabel>
              {acuity && (
                <span className="text-sm font-medium" style={{ color: "#64748b" }}>
                  {acuityManual ? "Manual override" : "Auto-suggested"}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              {ACUITY_ORDER.map((level) => {
                const cfg = TRIAGE_CONFIG[level];
                const selected = acuity === level;
                return (
                  <button key={level} type="button" onClick={() => handleAcuitySelect(level)}
                    className="flex flex-1 flex-col items-center gap-1 rounded-xl py-4 transition-all"
                    style={{
                      background: selected ? cfg.color : "transparent",
                      color: selected ? "#ffffff" : cfg.dimText,
                      border: `2px solid ${selected ? cfg.color : cfg.color + "50"}`,
                    }}>
                    <span className="text-lg font-bold">T{cfg.num}</span>
                    <span className="text-sm" style={{ opacity: selected ? 1 : 0.85 }}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {errors.acuity && (
              <p className="mt-2 text-sm" style={{ color: "#E24B4A" }}>{errors.acuity}</p>
            )}
          </section>

          <Divider />

          {/* Symptoms */}
          <section>
            <SectionLabel>Symptoms</SectionLabel>
            <div className="flex flex-wrap gap-3">
              {SYMPTOMS.map((s) => {
                const active = symptoms.has(s);
                return (
                  <button key={s} type="button" onClick={() => toggleSymptom(s)}
                    className="rounded-full px-5 py-3 text-lg transition-colors"
                    style={{
                      background: active ? activeTriageColor + "15" : "#f1f5f9",
                      color: active ? activeTriageColor : "#334155",
                      border: `1.5px solid ${active ? activeTriageColor : "#cbd5e1"}`,
                      fontWeight: active ? 600 : 500,
                    }}>
                    {s}
                  </button>
                );
              })}
              <button type="button" onClick={() => setOtherSymptomSelected((v) => !v)}
                className="rounded-full px-5 py-3 text-lg transition-colors"
                style={{
                  background: otherSymptomSelected ? activeTriageColor + "15" : "#f1f5f9",
                  color: otherSymptomSelected ? activeTriageColor : "#334155",
                  border: `1.5px solid ${otherSymptomSelected ? activeTriageColor : "#cbd5e1"}`,
                  fontWeight: otherSymptomSelected ? 600 : 500,
                }}>
                Other
              </button>
            </div>
            {otherSymptomSelected && (
              <input
                type="text"
                value={otherSymptom}
                onChange={(e) => setOtherSymptom(e.target.value)}
                placeholder="Describe symptom..."
                className="mt-3 w-full rounded-xl px-4 py-3 text-base outline-none"
                style={{ background: "#ffffff", border: "1.5px solid #94a3b8", color: "#0f172a" }}
              />
            )}
          </section>

          {/* Spacer + submit at bottom */}
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="mt-6 w-full rounded-xl py-4 text-lg font-bold tracking-wide transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: submitColor, color: "white" }}
          >
            {submitting ? "Checking in..." : "Check in patient"}
          </button>
        </div>

        {/* ═══════ RIGHT PANEL: Secondary details ═══════ */}
        <div className="flex flex-[2] flex-col gap-6 overflow-y-auto">

          {/* Patient info card */}
          <div className="rounded-2xl p-6" style={{ background: "#ffffff", border: "1px solid #cbd5e1" }}>
            <SectionLabel>Patient information</SectionLabel>
            <div className="flex flex-col gap-3">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Patient name (optional)"
                className="rounded-xl px-4 py-3 text-base outline-none"
                style={{ background: "#ffffff", border: "1.5px solid #94a3b8", color: "#0f172a" }} />
              <div className="flex gap-3">
                <input type="number" value={age} onChange={(e) => setAge(e.target.value)}
                  placeholder="Age" min={0} max={120}
                  className="w-24 rounded-xl px-4 py-3 text-base outline-none"
                  style={{ background: "#ffffff", border: "1.5px solid #94a3b8", color: "#0f172a" }} />
                <div className="flex flex-1 gap-2">
                  {(["M", "F", "NB"] as const).map((s) => {
                    const full = s === "M" ? "Male" : s === "F" ? "Female" : "Non-binary";
                    const on = sex === full;
                    return (
                      <button key={s} type="button" onClick={() => setSex(on ? "" : full)}
                        className="flex-1 rounded-xl py-3 text-sm font-semibold transition-colors"
                        style={{
                          background: on ? "#2563eb" : "#ffffff",
                          color: on ? "#ffffff" : "#334155",
                          border: `1.5px solid ${on ? "#2563eb" : "#94a3b8"}`,
                        }}>
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)}
                className="rounded-xl px-4 py-3 text-base outline-none"
                style={{ background: "#ffffff", border: "1.5px solid #94a3b8", color: "#0f172a", colorScheme: "light" }} />
            </div>
            {recentCheckins.length > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: "#475569" }}>Recent:</span>
                {recentCheckins.slice(0, 3).map((c, i) => (
                  <span key={i} className="rounded-lg px-2.5 py-1 font-mono text-sm"
                    style={{ background: "#f0fdf4", color: "#15803d" }}
                    title={`${c.name} — ${c.complaint}`}>
                    {c.patient_id}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Camera monitoring card */}
          <div className="flex items-center justify-between rounded-2xl p-6"
            style={{ background: "#ffffff", border: "1px solid #cbd5e1" }}>
            <div>
              <p className="text-base font-semibold" style={{ color: "#0f172a" }}>Camera monitoring</p>
              <p className="text-sm" style={{ color: "#475569" }}>Patient consents to remote biometric monitoring</p>
            </div>
            <button type="button" role="switch" aria-checked={cameraOptIn}
              onClick={() => setCameraOptIn((v) => !v)}
              className="relative h-8 w-14 flex-shrink-0 rounded-full transition-colors"
              style={{ background: cameraOptIn ? "#2563eb" : "#94a3b8" }}>
              <span className="absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all"
                style={{ left: cameraOptIn ? "calc(100% - 1.75rem)" : "4px" }} />
            </button>
          </div>

          {/* AI monitoring config (collapsible) */}
          <div className="rounded-2xl" style={{ background: "#ffffff", border: "1px solid #cbd5e1" }}>
            <button type="button" onClick={() => setShowAiConfig((v) => !v)}
              className="flex w-full items-center justify-between px-6 py-5 text-left">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#1e293b" }}>
                  AI monitoring
                </h2>
                {acuity && (
                  <span className="rounded-full px-3 py-1 text-sm font-medium"
                    style={{
                      background: TRIAGE_CONFIG[acuity].color + "12",
                      color: TRIAGE_CONFIG[acuity].color,
                    }}>
                    {cvInstructions.alert_sensitivity}
                  </span>
                )}
              </div>
              <span className="text-sm" style={{ color: "#64748b", transform: showAiConfig ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                &#9660;
              </span>
            </button>

            {showAiConfig && (
              <div className="px-6 pb-6" style={{ borderTop: "1.5px solid #cbd5e1" }}>
                {selectedComplaints.size === 0 ? (
                  <p className="pt-4 text-base" style={{ color: "#64748b" }}>Select a complaint to configure</p>
                ) : (
                  <div className="flex gap-8 pt-4">
                    <div className="flex-1 min-w-0">
                      <p className="mb-3 text-sm font-semibold" style={{ color: "#334155" }}>Tracking</p>
                      {cvInstructions.track_priority.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {cvInstructions.track_priority.map((s) => (
                            <span key={s} className="rounded-lg px-3 py-1 text-sm"
                              style={{ background: "#3b82f610", color: "#3b82f6" }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm" style={{ color: "#64748b" }}>No specific signals</p>
                      )}
                      {cvInstructions.ignore_flags.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-sm font-semibold" style={{ color: "#334155" }}>Ignoring</p>
                          <div className="flex flex-wrap gap-2">
                            {cvInstructions.ignore_flags.map((s) => (
                              <span key={s} className="rounded-lg px-3 py-1 text-sm"
                                style={{ background: "#64748b15", color: "#475569" }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="w-44 flex-shrink-0">
                      <p className="mb-2 text-sm font-semibold" style={{ color: "#334155" }}>Sensitivity</p>
                      <p className="mb-5 text-lg font-semibold capitalize"
                        style={{ color: acuity ? TRIAGE_CONFIG[acuity].color : "#64748b" }}>
                        {cvInstructions.alert_sensitivity}
                      </p>
                      <p className="mb-2 text-sm font-semibold" style={{ color: "#334155" }}>Always on</p>
                      <div className="flex flex-col gap-1">
                        {UNIVERSAL_FLAGS.map((f) => (
                          <span key={f} className="text-sm" style={{ color: "#475569" }}>
                            {f.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
