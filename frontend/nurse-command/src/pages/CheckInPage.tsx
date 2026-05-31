import { useMemo, useState } from "react";
import type { AcuityLevel } from "@shared/types/telemetry";
import { CheckInQrModal } from "../components/CheckInQrModal";
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
  RESUSCITATION: { num: 1, label: "Resuscitation", desc: "Immediate life threat",  color: "#E24B4A", dimBg: "#fef2f2", dimText: "#b91c1c" },
  EMERGENT:      { num: 2, label: "Emergent",      desc: "May deteriorate rapidly", color: "#f97316", dimBg: "#fff7ed", dimText: "#c2410c" },
  URGENT:        { num: 3, label: "Urgent",        desc: "Needs prompt care",       color: "#eab308", dimBg: "#fefce8", dimText: "#a16207" },
  LESS_URGENT:   { num: 4, label: "Less urgent",   desc: "Stable, can wait",        color: "#22c55e", dimBg: "#f0fdf4", dimText: "#15803d" },
  NON_URGENT:    { num: 5, label: "Non-urgent",    desc: "Minor complaint",          color: "#3b82f6", dimBg: "#eff6ff", dimText: "#1d4ed8" },
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

  const [errors, setErrors] = useState<{ complaint?: string; acuity?: string }>({});
  const [successCheckin, setSuccessCheckin] = useState<CheckInResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<
    { name: string; patient_id: string; complaint: string; time: string }[]
  >([]);

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
      setErrors({});
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  const submitColor = acuity ? TRIAGE_CONFIG[acuity].color : "#1f2937";
  const activeTriageColor = acuity ? TRIAGE_CONFIG[acuity].color : "#374151";

  const inputClass =
    "intake-input telemetry-value border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)]";

  // ─── Layout ───────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface)]">
      <header className="panel-header flex-shrink-0">
        <p className="telemetry-label">Patient check-in</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-px overflow-y-auto bg-[var(--border-subtle)] p-px">
        {successCheckin && (
          <CheckInQrModal
            displayName={successCheckin.display_name}
            patientId={successCheckin.patient_id}
            onClose={() => setSuccessCheckin(null)}
          />
        )}

        {submitError && (
          <p className="flex-shrink-0 border border-[var(--status-critical)] bg-red-50 px-3 py-2 text-xs text-[var(--status-critical)]">
            {submitError}
          </p>
        )}

        {/* Row 1 — patient info bar */}
        <div className="flex flex-shrink-0 flex-wrap items-center gap-px bg-[var(--border-subtle)]">
          <div className="min-w-[10rem] flex-1 bg-[var(--surface)] px-3 py-2">
            <label htmlFor="checkin-name" className="telemetry-label block text-[10px]">
              Patient name
            </label>
            <input
              id="checkin-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Last, First"
              className={`${inputClass} mt-1 w-full`}
            />
          </div>
          <div className="w-20 bg-[var(--surface)] px-3 py-2">
            <label htmlFor="checkin-age" className="telemetry-label block text-[10px]">
              Age
            </label>
            <input
              id="checkin-age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="—"
              min={0}
              max={120}
              className={`${inputClass} mt-1 w-full`}
            />
          </div>
          <div className="bg-[var(--surface)] px-3 py-2">
            <p className="telemetry-label text-[10px]">Sex</p>
            <div className="mt-1 flex gap-px bg-[var(--border-subtle)]">
              {(["M", "F", "NB"] as const).map((s) => {
                const full = s === "M" ? "Male" : s === "F" ? "Female" : "Non-binary";
                const on = sex === full;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSex(on ? "" : full)}
                    className="intake-input border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      background: on ? "var(--surface-2)" : "var(--surface)",
                      color: on ? "var(--text)" : "var(--text-muted)",
                      borderColor: on ? "var(--text)" : "var(--border-subtle)",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bg-[var(--surface)] px-3 py-2">
            <label htmlFor="checkin-arrival" className="telemetry-label block text-[10px]">
              Arrival
            </label>
            <input
              id="checkin-arrival"
              type="time"
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              className={`${inputClass} telemetry-value mt-1`}
              style={{ colorScheme: "light" }}
            />
          </div>
          {recentCheckins.length > 0 && (
            <div className="flex flex-wrap items-end gap-1 bg-[var(--surface)] px-3 py-2">
              <p className="telemetry-label w-full text-[10px]">Recent</p>
              {recentCheckins.slice(0, 3).map((c, i) => (
                <span
                  key={i}
                  className="telemetry-value border border-[var(--status-stable)] bg-green-50 px-1.5 py-px text-[10px] text-[var(--status-stable)]"
                  title={c.name}
                >
                  {c.patient_id}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Row 2 — chief complaint tiles */}
        <div className="flex-shrink-0 bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="telemetry-label text-[11px]">
              Chief complaint <span className="text-[var(--status-critical)]">*</span>
            </p>
            {selectedComplaints.size > 0 && (
              <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                {selectedComplaints.size > 1
                  ? `${selectedComplaints.size} selected`
                  : Array.from(selectedComplaints)[0]}
              </p>
            )}
          </div>
          <div className="grid grid-cols-5 grid-rows-2 gap-px bg-[var(--border-subtle)]">
            {COMPLAINT_TILES.map((tile, index) => {
              const active = selectedComplaints.has(tile.label);
              const cfg = tile.suggestedAcuity ? TRIAGE_CONFIG[tile.suggestedAcuity] : null;
              const tileColor = cfg?.color ?? "#374151";
              return (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => toggleComplaint(tile.label)}
                  className="intake-input relative flex min-h-[4.5rem] flex-col items-start justify-center border border-[var(--border-subtle)] px-3 py-3 text-left"
                  style={{
                    background: active ? "var(--surface-2)" : "var(--surface)",
                    borderColor: active ? tileColor : undefined,
                  }}
                >
                  {cfg && (
                    <span
                      className="telemetry-value absolute right-2 top-2 text-[10px] font-bold"
                      style={{ color: active ? cfg.color : "var(--text-dim)" }}
                    >
                      T{cfg.num}
                    </span>
                  )}
                  <span
                    className="pr-6 text-sm font-semibold leading-snug"
                    style={{ color: active ? tileColor : "var(--text)" }}
                  >
                    {tile.label}
                  </span>
                  <span className="telemetry-value mt-1 text-[10px] text-[var(--text-dim)]">
                    {index + 1}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedComplaints.has("Other") && (
            <textarea
              rows={2}
              value={otherDetail}
              onChange={(e) => setOtherDetail(e.target.value)}
              placeholder="Other / add detail…"
              className={`${inputClass} mt-px w-full resize-none`}
            />
          )}
          {errors.complaint && (
            <p className="mt-1 text-xs text-[var(--status-critical)]">{errors.complaint}</p>
          )}
        </div>

        {/* Row 3 — triage level */}
        <div className="flex-shrink-0 bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="telemetry-label text-[11px]">
              Triage level <span className="text-[var(--status-critical)]">*</span>
            </p>
            {acuity && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                {acuityManual ? "Manually set" : "Auto-suggested · tap to override"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-5 gap-px bg-[var(--border-subtle)]">
            {ACUITY_ORDER.map((level) => {
              const cfg = TRIAGE_CONFIG[level];
              const selected = acuity === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleAcuitySelect(level)}
                  className="intake-input flex min-h-[3.5rem] flex-col items-center justify-center border bg-[var(--surface)] px-2 py-2"
                  style={{
                    borderColor: selected ? cfg.color : "var(--border-subtle)",
                    background: selected ? cfg.dimBg : "var(--surface)",
                  }}
                >
                  <p
                    className="telemetry-value text-sm font-bold"
                    style={{ color: selected ? cfg.color : cfg.dimText }}
                  >
                    T{cfg.num}
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: selected ? cfg.color : cfg.dimText }}>
                    {cfg.label}
                  </p>
                </button>
              );
            })}
          </div>
          {errors.acuity && (
            <p className="mt-1 text-xs text-[var(--status-critical)]">{errors.acuity}</p>
          )}
        </div>

        {/* Row 4 — symptoms */}
        <div className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
          <p className="telemetry-label mb-2 text-[11px]">Associated symptoms</p>
          <div className="grid grid-cols-4 gap-px bg-[var(--border-subtle)] sm:grid-cols-8">
            {SYMPTOMS.map((s) => {
              const active = symptoms.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSymptom(s)}
                  className="intake-input flex min-h-[2.75rem] items-center justify-center border px-2 py-2 text-sm font-medium"
                  style={{
                    background: active ? "var(--surface)" : "var(--surface-2)",
                    color: active ? activeTriageColor : "var(--text-muted)",
                    borderColor: active ? activeTriageColor : "var(--border-subtle)",
                  }}
                >
                  {s}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setOtherSymptomSelected((v) => !v)}
              className="intake-input flex min-h-[2.75rem] items-center justify-center border px-2 py-2 text-sm font-medium"
              style={{
                background: otherSymptomSelected ? "var(--surface)" : "var(--surface-2)",
                color: otherSymptomSelected ? activeTriageColor : "var(--text-muted)",
                borderColor: otherSymptomSelected ? activeTriageColor : "var(--border-subtle)",
              }}
            >
              Other
            </button>
          </div>
          {otherSymptomSelected && (
            <input
              type="text"
              value={otherSymptom}
              onChange={(e) => setOtherSymptom(e.target.value)}
              placeholder="Describe symptom…"
              className={`${inputClass} mt-px w-full`}
            />
          )}
        </div>

        {/* Row 5 — AI monitoring config */}
        <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--border-subtle)] bg-[var(--surface)] p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="telemetry-label text-[11px]">AI monitoring config</p>
            <span
              className="border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: acuity ? TRIAGE_CONFIG[acuity].color + "18" : "var(--surface-2)",
                color: acuity ? TRIAGE_CONFIG[acuity].color : "var(--text-muted)",
                borderColor: acuity ? TRIAGE_CONFIG[acuity].color + "40" : "var(--border-subtle)",
              }}
            >
              {cvInstructions.alert_sensitivity} sensitivity
            </span>
          </div>

          {selectedComplaints.size === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">Select a complaint to configure AI monitoring</p>
          ) : (
            <div className="flex gap-8 overflow-hidden">
              <div className="min-w-0 flex-1">
                <p className="telemetry-label mb-2 text-[10px]">Tracking closely</p>
                {cvInstructions.track_priority.length > 0 ? (
                  <div className="flex flex-wrap gap-px bg-[var(--border-subtle)]">
                    {cvInstructions.track_priority.map((s) => (
                      <span
                        key={s}
                        className="border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-2)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">No specific signals for this complaint</p>
                )}
                {cvInstructions.ignore_flags.length > 0 && (
                  <div className="mt-3">
                    <p className="telemetry-label mb-1.5 text-[10px]">Ignoring</p>
                    <div className="flex flex-wrap gap-px bg-[var(--border-subtle)]">
                      {cvInstructions.ignore_flags.map((s) => (
                        <span
                          key={s}
                          className="border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--text-muted)]"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="w-44 flex-shrink-0">
                <p className="telemetry-label mb-2 text-[10px]">Alert sensitivity</p>
                <p
                  className="mb-4 text-sm font-semibold capitalize"
                  style={{ color: acuity ? TRIAGE_CONFIG[acuity].color : "var(--text-muted)" }}
                >
                  {cvInstructions.alert_sensitivity}
                </p>
                <p className="telemetry-label mb-1.5 text-[10px]">Always monitoring</p>
                <div className="flex flex-col gap-1">
                  {UNIVERSAL_FLAGS.map((f) => (
                    <span key={f} className="text-xs text-[var(--text-2)]">
                      · {f.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="intake-submit flex-shrink-0 w-full border py-3 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: submitColor, borderColor: submitColor }}
        >
          {submitting ? "Checking in…" : "Check in patient →"}
        </button>
      </div>
    </div>
  );
}
