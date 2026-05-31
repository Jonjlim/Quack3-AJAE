import { useCallback, useEffect, useRef, useState } from "react";
import type { AcuityLevel } from "@shared/types/telemetry";
import type { CheckInData, CheckInResult } from "../hooks/useTriageSocket";

type VisualAcuity = "LOW" | "MED" | "HIGH";

const VISUAL_ACUITY_OPTIONS: {
  value: VisualAcuity;
  label: string;
  acuity: AcuityLevel;
  color: string;
}[] = [
  { value: "LOW", label: "Low", acuity: "LESS_URGENT", color: "#15803d" },
  { value: "MED", label: "Med", acuity: "URGENT", color: "#d97706" },
  { value: "HIGH", label: "High", acuity: "EMERGENT", color: "#dc2626" },
];

interface ManualIntakePanelProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CheckInData) => Promise<CheckInResult>;
}

export function ManualIntakePanel({ open, onClose, onSubmit }: ManualIntakePanelProps) {
  const [lastName, setLastName] = useState("");
  const [complaint, setComplaint] = useState("");
  const [visualAcuity, setVisualAcuity] = useState<VisualAcuity>("MED");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);

  const lastNameRef = useRef<HTMLInputElement>(null);
  const complaintRef = useRef<HTMLInputElement>(null);
  const acuityRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const resetForm = useCallback(() => {
    setLastName("");
    setComplaint("");
    setVisualAcuity("MED");
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => lastNameRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const commit = useCallback(async () => {
    const name = lastName.trim();
    const complaintText = complaint.trim();
    if (!name) {
      setError("Last name / initial required.");
      lastNameRef.current?.focus();
      return;
    }
    if (!complaintText) {
      setError("Chief complaint required.");
      complaintRef.current?.focus();
      return;
    }

    const acuity = VISUAL_ACUITY_OPTIONS.find((o) => o.value === visualAcuity)!.acuity;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit({
        displayName: name,
        complaint: complaintText,
        acuity,
      });
      setLastResult(result);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Intake failed");
    } finally {
      setSubmitting(false);
      requestAnimationFrame(() => lastNameRef.current?.focus());
    }
  }, [lastName, complaint, visualAcuity, onSubmit, resetForm]);

  function handleAcuityKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      acuityRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < VISUAL_ACUITY_OPTIONS.length - 1) {
      e.preventDefault();
      acuityRefs.current[index + 1]?.focus();
    } else if (e.key === "1") {
      setVisualAcuity("LOW");
      acuityRefs.current[0]?.focus();
    } else if (e.key === "2") {
      setVisualAcuity("MED");
      acuityRefs.current[1]?.focus();
    } else if (e.key === "3") {
      setVisualAcuity("HIGH");
      acuityRefs.current[2]?.focus();
    }
  }

  if (!open) return null;

  return (
    <section
      className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface-2)]"
      aria-label="Manual patient intake override"
    >
      <header className="flex items-center justify-between border-b border-[var(--border-subtle)] px-2 py-1">
        <h2 className="telemetry-label text-[var(--text)]">Manual Intake Override</h2>
        <button
          type="button"
          onClick={onClose}
          className="intake-input px-1 py-px text-[9px] font-semibold uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text)]"
          title="Close (Esc)"
        >
          Esc
        </button>
      </header>

      <form
        className="space-y-1.5 px-2 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void commit();
        }}
      >
        <div>
          <label htmlFor="manual-intake-name" className="telemetry-label block">
            Last Name / Initial
          </label>
          <input
            ref={lastNameRef}
            id="manual-intake-name"
            type="text"
            value={lastName}
            onChange={(e) => {
              setLastName(e.target.value);
              if (error) setError(null);
            }}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. Nguyen, A"
            className="intake-input telemetry-value mt-0.5 w-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)]"
          />
        </div>

        <div>
          <label htmlFor="manual-intake-complaint" className="telemetry-label block">
            Chief Complaint
          </label>
          <input
            ref={complaintRef}
            id="manual-intake-complaint"
            type="text"
            value={complaint}
            onChange={(e) => {
              setComplaint(e.target.value);
              if (error) setError(null);
            }}
            autoComplete="off"
            placeholder="e.g. Unresponsive, chest pain"
            className="intake-input telemetry-value mt-0.5 w-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-dim)]"
          />
        </div>

        <div>
          <span className="telemetry-label block" id="manual-intake-acuity-label">
            Visual Acuity Est.
          </span>
          <div
            className="mt-0.5 flex gap-px bg-[var(--border-subtle)]"
            role="radiogroup"
            aria-labelledby="manual-intake-acuity-label"
          >
            {VISUAL_ACUITY_OPTIONS.map((opt, i) => {
              const selected = visualAcuity === opt.value;
              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    acuityRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setVisualAcuity(opt.value)}
                  onKeyDown={(e) => handleAcuityKeyDown(e, i)}
                  className={`intake-input flex-1 border py-1.5 text-[10px] font-semibold uppercase tracking-widest ${
                    selected ? "bg-[var(--surface)]" : "bg-[var(--surface-2)] text-[var(--text-dim)]"
                  }`}
                  style={
                    selected
                      ? { borderColor: opt.color, color: opt.color }
                      : { borderColor: "var(--border-subtle)" }
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            Keys 1 · 2 · 3
          </p>
        </div>

        {error && (
          <p className="border border-[var(--status-critical)] bg-red-50 px-2 py-1 text-[10px] text-[var(--status-critical)]" role="alert">
            {error}
          </p>
        )}

        {lastResult && (
          <p className="border border-[var(--status-stable)] bg-green-50 px-2 py-1 text-[10px] text-[var(--status-stable)]">
            Committed{" "}
            <span className="telemetry-value font-medium">{lastResult.patient_id}</span>
            {" · "}
            {lastResult.display_name}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="intake-submit w-full border border-slate-900 bg-slate-900 py-2 text-[10px] font-bold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Committing…" : "Commit to Queue [Enter]"}
        </button>
      </form>
    </section>
  );
}
