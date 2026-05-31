import { useMemo } from "react";
import type { AcuityLevel } from "@shared/types/telemetry";
import {
  ALERT_SENSITIVITY,
  COMPLAINT_TILES,
  CV_IGNORE_MAP,
  CV_TRACK_MAP,
  SYMPTOMS,
  type Symptom,
} from "../../mock/mockData";
import { ACUITY_ORDER, TRIAGE_CONFIG } from "./checkin-constants";

interface CheckInStepComplaintProps {
  selectedComplaints: Set<string>;
  symptoms: Set<Symptom>;
  clinicalNotes: string;
  otherDetail: string;
  acuity: AcuityLevel | null;
  acuityManual: boolean;
  onToggleComplaint: (label: string) => void;
  onToggleSymptom: (symptom: Symptom) => void;
  onClinicalNotesChange: (value: string) => void;
  onOtherDetailChange: (value: string) => void;
  onAcuitySelect: (level: AcuityLevel) => void;
  errors: { complaint?: string; acuity?: string };
}

export function CheckInStepComplaint({
  selectedComplaints,
  symptoms,
  clinicalNotes,
  otherDetail,
  acuity,
  acuityManual,
  onToggleComplaint,
  onToggleSymptom,
  onClinicalNotesChange,
  onOtherDetailChange,
  onAcuitySelect,
  errors,
}: CheckInStepComplaintProps) {
  const cvSummary = useMemo(() => {
    const labels = Array.from(selectedComplaints).filter((l) => l !== "Other");
    const track = [...new Set(labels.flatMap((l) => CV_TRACK_MAP[l] ?? []))];
    const ignore = [...new Set(labels.flatMap((l) => CV_IGNORE_MAP[l] ?? []))];
    const extra: string[] = [];
    if (symptoms.has("Bleeding")) extra.push("active bleeding visible");
    if (symptoms.has("Confusion")) extra.push("confusion behavior");
    if (symptoms.has("Shortness of breath") && !track.includes("labored breathing")) {
      extra.push("labored breathing");
    }
    return {
      track: [...new Set([...track, ...extra])].filter((f) => !ignore.includes(f)),
      sensitivity: ALERT_SENSITIVITY[acuity ?? "URGENT"],
    };
  }, [selectedComplaints, symptoms, acuity]);

  const suggestedCfg = acuity ? TRIAGE_CONFIG[acuity] : null;
  const activeTriageColor = acuity ? TRIAGE_CONFIG[acuity].color : "#374151";

  return (
    <div className="flex h-full min-h-0 flex-col gap-px bg-[var(--border-subtle)] p-px">
      <div className="grid min-h-[11rem] flex-shrink-0 grid-cols-12 gap-px bg-[var(--border-subtle)]">
        <div className="col-span-8 flex flex-col bg-[var(--surface)] p-3">
          <label htmlFor="checkin-notes" className="telemetry-label block text-[11px]">
            Chief complaint narrative
          </label>
          <textarea
            id="checkin-notes"
            value={clinicalNotes}
            onChange={(e) => onClinicalNotesChange(e.target.value)}
            placeholder="Onset, duration, severity, context, mechanism of injury…"
            className="intake-input telemetry-value mt-1 min-h-[8rem] flex-1 resize-none border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--text-dim)]"
          />
        </div>
        <div className="col-span-4 flex flex-col bg-[var(--surface)] p-3">
          <p className="telemetry-label mb-2 text-[11px]">
            Triage level <span className="text-[var(--status-critical)]">*</span>
          </p>
          <div className="grid flex-1 grid-cols-1 gap-px bg-[var(--border-subtle)]">
            {ACUITY_ORDER.map((level) => {
              const cfg = TRIAGE_CONFIG[level];
              const selected = acuity === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onAcuitySelect(level)}
                  className="intake-input flex flex-1 items-center justify-between border bg-[var(--surface)] px-3 py-2"
                  style={{
                    borderColor: selected ? cfg.color : "var(--border-subtle)",
                    background: selected ? cfg.dimBg : "var(--surface)",
                  }}
                >
                  <span
                    className="telemetry-value text-lg font-bold"
                    style={{ color: selected ? cfg.color : cfg.dimText }}
                  >
                    T{cfg.num}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: selected ? cfg.color : cfg.dimText }}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
          {suggestedCfg && selectedComplaints.size > 0 && (
            <p
              className="mt-2 text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: suggestedCfg.color }}
            >
              Suggested T{suggestedCfg.num} {!acuityManual && "· auto"}
            </p>
          )}
          {errors.acuity && (
            <p className="mt-1 text-xs text-[var(--status-critical)]">{errors.acuity}</p>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="telemetry-label text-[11px]">
            Presenting complaints <span className="text-[var(--status-critical)]">*</span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            Keys 1–9 · 0
          </p>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-5 grid-rows-2 gap-px bg-[var(--border-subtle)]">
          {COMPLAINT_TILES.map((tile, index) => {
            const active = selectedComplaints.has(tile.label);
            const cfg = tile.suggestedAcuity ? TRIAGE_CONFIG[tile.suggestedAcuity] : null;
            const tileColor = cfg?.color ?? "#374151";
            return (
              <button
                key={tile.label}
                type="button"
                onClick={() => onToggleComplaint(tile.label)}
                className="intake-input relative flex h-full min-h-[4.5rem] flex-col items-start justify-center border border-[var(--border-subtle)] px-3 py-3 text-left"
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
                <span className="telemetry-value mt-1 text-[10px] text-[var(--text-dim)]">{index + 1}</span>
              </button>
            );
          })}
        </div>
        {selectedComplaints.has("Other") && (
          <input
            type="text"
            value={otherDetail}
            onChange={(e) => onOtherDetailChange(e.target.value)}
            placeholder="Specify other complaint…"
            className="intake-input mt-px w-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-base text-[var(--text)] placeholder:text-[var(--text-dim)]"
          />
        )}
        {errors.complaint && (
          <p className="mt-1 text-xs text-[var(--status-critical)]">{errors.complaint}</p>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
        <p className="telemetry-label mb-2 text-[11px]">Associated symptoms</p>
        <div className="grid grid-cols-4 gap-px bg-[var(--border-subtle)] sm:grid-cols-8">
          {SYMPTOMS.map((s) => {
            const active = symptoms.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onToggleSymptom(s)}
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
        </div>
      </div>

      {(selectedComplaints.size > 0 || symptoms.size > 0) && (
        <p className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-2)]">
          AI monitor · <span className="capitalize">{cvSummary.sensitivity}</span> sensitivity
          {cvSummary.track.length > 0 && <> · tracking {cvSummary.track.join(", ")}</>}
        </p>
      )}
    </div>
  );
}
