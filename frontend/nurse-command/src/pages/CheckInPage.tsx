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

// ─── Visual-only constants ────────────────────────────────────────────────────

const TRIAGE_CONFIG: Record<
  AcuityLevel,
  { num: number; label: string; desc: string; color: string; dimBg: string; dimText: string }
> = {
  RESUSCITATION: { num: 1, label: "Resuscitation", desc: "Immediate life threat",  color: "#E24B4A", dimBg: "#2d0e0e", dimText: "#E24B4A90" },
  EMERGENT:      { num: 2, label: "Emergent",      desc: "May deteriorate rapidly", color: "#f97316", dimBg: "#2d1508", dimText: "#f9731690" },
  URGENT:        { num: 3, label: "Urgent",        desc: "Needs prompt care",       color: "#eab308", dimBg: "#2a2508", dimText: "#eab30890" },
  LESS_URGENT:   { num: 4, label: "Less urgent",   desc: "Stable, can wait",        color: "#22c55e", dimBg: "#0a2d12", dimText: "#22c55e90" },
  NON_URGENT:    { num: 5, label: "Non-urgent",    desc: "Minor complaint",          color: "#3b82f6", dimBg: "#08182d", dimText: "#3b82f690" },
};

const ACUITY_ORDER: AcuityLevel[] = ["RESUSCITATION", "EMERGENT", "URGENT", "LESS_URGENT", "NON_URGENT"];


// ─── Logic (unchanged) ────────────────────────────────────────────────────────

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

  const submitColor = acuity ? TRIAGE_CONFIG[acuity].color : "#1d4ed8";
  const activeTriageColor = acuity ? TRIAGE_CONFIG[acuity].color : "#3b82f6";

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden px-5 py-4">

      {/* Success toast */}
      {successCheckin && (
        <div className="flex flex-shrink-0 flex-col gap-1 rounded-lg px-4 py-2"
          style={{ background: "#0d1a0f", border: "1px solid #63992260" }}>
          <p className="text-sm font-semibold text-white">
            <span style={{ color: "#639922" }}>✓ {successCheckin.display_name}</span> checked in —
            share this ID with the patient:
          </p>
          <p className="font-mono text-base font-bold tracking-wide text-emerald-300">
            {successCheckin.patient_id}
          </p>
        </div>
      )}

      {submitError && (
        <p className="flex-shrink-0 rounded-lg px-4 py-2 text-sm text-red-300"
          style={{ background: "#1a0d0d", border: "1px solid #7f1d1d60" }}>
          {submitError}
        </p>
      )}

      {/* Row 1 — patient info bar */}
      <div className="flex flex-shrink-0 items-center gap-3 rounded-lg px-4 py-2.5"
        style={{ background: "#0d1526", border: "1px solid #1e293b" }}>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Patient name"
          className="flex-1 bg-transparent text-sm text-white placeholder-slate-600 outline-none" />
        <div className="h-4 w-px bg-slate-800" />
        <input type="number" value={age} onChange={(e) => setAge(e.target.value)}
          placeholder="Age" min={0} max={120}
          className="w-14 bg-transparent text-sm text-white placeholder-slate-600 outline-none" />
        <div className="h-4 w-px bg-slate-800" />
        <div className="flex gap-1">
          {(["M", "F", "NB"] as const).map((s) => {
            const full = s === "M" ? "Male" : s === "F" ? "Female" : "Non-binary";
            const on = sex === full;
            return (
              <button key={s} type="button" onClick={() => setSex(on ? "" : full)}
                className="rounded px-2 py-0.5 text-xs font-semibold transition-colors"
                style={{
                  background: on ? "#3b82f620" : "transparent",
                  color: on ? "#3b82f6" : "#475569",
                  border: `1px solid ${on ? "#3b82f650" : "transparent"}`,
                }}>
                {s}
              </button>
            );
          })}
        </div>
        <div className="h-4 w-px bg-slate-800" />
        <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)}
          className="bg-transparent text-sm text-slate-400 outline-none"
          style={{ colorScheme: "dark" }} />
        {recentCheckins.length > 0 && (
          <>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex gap-2">
              {recentCheckins.slice(0, 3).map((c, i) => (
                <span key={i} className="rounded px-2 py-0.5 font-mono text-xs font-medium"
                  style={{ background: "#63992218", color: "#639922", border: "1px solid #63992230" }}
                  title={c.name}>
                  {c.patient_id}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Row 2 — chief complaint tiles (5 × 2 grid, h-14 each) */}
      <div className="flex-shrink-0">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Chief complaint <span style={{ color: "#E24B4A" }}>*</span>
          </p>
          {selectedComplaints.size > 0 && (
            <p className="text-xs text-slate-500">
              {selectedComplaints.size > 1 ? `${selectedComplaints.size} selected` : Array.from(selectedComplaints)[0]}
            </p>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {COMPLAINT_TILES.map((tile) => {
            const active = selectedComplaints.has(tile.label);
            const cfg = tile.suggestedAcuity ? TRIAGE_CONFIG[tile.suggestedAcuity] : null;
            const tileColor = cfg?.color ?? "#3b82f6";
            return (
              <button key={tile.label} type="button" onClick={() => toggleComplaint(tile.label)}
                className="relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-lg text-center transition-all"
                style={{
                  background: active ? tileColor + "20" : "#0d1526",
                  border: `1px solid ${active ? tileColor + "80" : "rgba(255,255,255,0.08)"}`,
                }}>
                {/* T badge — top-right corner */}
                {cfg && (
                  <span className="absolute right-1.5 top-1 text-[10px] font-bold leading-none"
                    style={{ color: active ? cfg.color : cfg.color + "55" }}>
                    T{cfg.num}
                  </span>
                )}
                <span className="text-sm font-semibold leading-tight"
                  style={{ color: active ? tileColor : "#94a3b8" }}>
                  {tile.label}
                </span>
              </button>
            );
          })}
        </div>
        {selectedComplaints.has("Other") && (
          <textarea rows={2} value={otherDetail}
            onChange={(e) => setOtherDetail(e.target.value)}
            placeholder="Other / add detail…"
            className="mt-2 w-full resize-none rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none"
            style={{ background: "#0d1526", border: "1px solid rgba(255,255,255,0.08)" }} />
        )}
        {errors.complaint && (
          <p className="mt-1 text-xs" style={{ color: "#E24B4A" }}>{errors.complaint}</p>
        )}
      </div>

      {/* Row 3 — triage level (h-14 buttons) */}
      <div className="flex-shrink-0">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Triage level <span style={{ color: "#E24B4A" }}>*</span>
          </p>
          {acuity && (
            <span className="text-[10px] text-slate-500">
              {acuityManual ? "Manually set" : "Auto-suggested · tap to override"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {ACUITY_ORDER.map((level) => {
            const cfg = TRIAGE_CONFIG[level];
            const selected = acuity === level;
            return (
              <button key={level} type="button" onClick={() => handleAcuitySelect(level)}
                className="flex h-14 flex-col items-center justify-center rounded-lg transition-all"
                style={{
                  background: selected ? cfg.color + "25" : cfg.dimBg,
                  border: `2px solid ${selected ? cfg.color : cfg.color + "35"}`,
                }}>
                <p className="text-sm font-bold" style={{ color: selected ? cfg.color : cfg.dimText }}>
                  T{cfg.num}
                </p>
                <p className="text-xs" style={{ color: selected ? cfg.color : cfg.dimText }}>
                  {cfg.label}
                </p>
              </button>
            );
          })}
        </div>
        {errors.acuity && (
          <p className="mt-1 text-xs" style={{ color: "#E24B4A" }}>{errors.acuity}</p>
        )}
      </div>

      {/* Row 4 — symptoms */}
      <div className="flex-shrink-0">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Symptoms</p>
        <div className="flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => {
            const active = symptoms.has(s);
            return (
              <button key={s} type="button" onClick={() => toggleSymptom(s)}
                className="rounded-full px-3 py-1 text-sm font-medium transition-colors"
                style={{
                  background: active ? activeTriageColor + "20" : "#0f1929",
                  color: active ? activeTriageColor : "#94a3b8",
                  border: `1px solid ${active ? activeTriageColor + "60" : "rgba(255,255,255,0.14)"}`,
                }}>
                {s}
              </button>
            );
          })}
          <button type="button" onClick={() => setOtherSymptomSelected((v) => !v)}
            className="rounded-full px-3 py-1 text-sm font-medium transition-colors"
            style={{
              background: otherSymptomSelected ? activeTriageColor + "20" : "#0f1929",
              color: otherSymptomSelected ? activeTriageColor : "#94a3b8",
              border: `1px solid ${otherSymptomSelected ? activeTriageColor + "60" : "rgba(255,255,255,0.14)"}`,
            }}>
            Other
          </button>
        </div>
        {otherSymptomSelected && (
          <input
            type="text"
            value={otherSymptom}
            onChange={(e) => setOtherSymptom(e.target.value)}
            placeholder="Describe symptom…"
            className="mt-2 w-full rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 outline-none"
            style={{ background: "#0d1526", border: "1px solid rgba(255,255,255,0.08)" }}
          />
        )}
      </div>

      {/* Row 5 — camera monitoring */}
      <div className="flex flex-shrink-0 items-center justify-between rounded-lg px-4 py-2.5"
        style={{ background: "#0d1526", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div>
          <p className="text-sm font-medium text-white">Camera monitoring</p>
          <p className="text-xs text-slate-600">Patient consents to remote biometric monitoring</p>
        </div>
        <button type="button" role="switch" aria-checked={cameraOptIn}
          onClick={() => setCameraOptIn((v) => !v)}
          className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors"
          style={{ background: cameraOptIn ? "#3b82f6" : "#1e293b" }}>
          <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
            style={{ left: cameraOptIn ? "calc(100% - 1.375rem)" : "2px" }} />
        </button>
      </div>

      {/* Row 6 — AI monitoring config (always-visible, grows to fill remaining space) */}
      <div className="flex min-h-0 flex-1 flex-col rounded-lg p-4"
        style={{ background: "#0a0f1c", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            AI monitoring config
          </p>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              background: acuity ? TRIAGE_CONFIG[acuity].color + "18" : "#1e293b",
              color: acuity ? TRIAGE_CONFIG[acuity].color : "#64748b",
              border: `1px solid ${acuity ? TRIAGE_CONFIG[acuity].color + "40" : "#334155"}`,
            }}>
            {cvInstructions.alert_sensitivity} sensitivity
          </span>
        </div>

        {selectedComplaints.size === 0 ? (
          <p className="text-sm text-slate-600">Select a complaint to configure AI monitoring</p>
        ) : (
          <div className="flex gap-8 overflow-hidden">
            {/* Left: tracking + ignore */}
            <div className="flex-1 min-w-0">
              <p className="mb-2 text-xs font-medium text-slate-500">Tracking closely</p>
              {cvInstructions.track_priority.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {cvInstructions.track_priority.map((s) => (
                    <span key={s} className="rounded px-2 py-0.5 text-xs"
                      style={{ background: "#3b82f618", color: "#3b82f6", border: "1px solid #3b82f625" }}>
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600">No specific signals for this complaint</p>
              )}
              {cvInstructions.ignore_flags.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Ignoring</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cvInstructions.ignore_flags.map((s) => (
                      <span key={s} className="rounded px-2 py-0.5 text-xs"
                        style={{ background: "#64748b18", color: "#64748b", border: "1px solid #64748b25" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: sensitivity + universal flags */}
            <div className="w-44 flex-shrink-0">
              <p className="mb-2 text-xs font-medium text-slate-500">Alert sensitivity</p>
              <p className="mb-4 text-sm font-semibold capitalize"
                style={{ color: acuity ? TRIAGE_CONFIG[acuity].color : "#64748b" }}>
                {cvInstructions.alert_sensitivity}
              </p>
              <p className="mb-1.5 text-xs font-medium text-slate-500">Always monitoring</p>
              <div className="flex flex-col gap-1">
                {UNIVERSAL_FLAGS.map((f) => (
                  <span key={f} className="text-xs" style={{ color: "#475569" }}>
                    · {f.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row 7 — submit */}
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className="flex-shrink-0 w-full rounded-lg py-3 text-base font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: submitColor, color: acuity === "URGENT" ? "#1c1a00" : "white" }}
      >
        {submitting ? "Checking in…" : "Check in patient →"}
      </button>
    </div>
  );
}
