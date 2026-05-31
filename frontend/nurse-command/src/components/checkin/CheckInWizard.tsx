import { useCallback, useEffect, useRef, useState } from "react";
import type { AcuityLevel } from "@shared/types/telemetry";
import type { CheckInData, CheckInResult } from "../../hooks/useTriageSocket";
import { COMPLAINT_TILES, type Symptom } from "../../mock/mockData";
import {
  ACUITY_SEVERITY,
  TRIAGE_CONFIG,
  WIZARD_STEPS,
  type WizardStep,
} from "./checkin-constants";
import { CheckInHandoffPanel } from "./CheckInHandoffPanel";
import { CheckInStepComplaint } from "./CheckInStepComplaint";
import { CheckInStepIdentity } from "./CheckInStepIdentity";

interface CheckInWizardProps {
  onSubmit: (data: CheckInData) => Promise<CheckInResult>;
}

function mostCriticalAcuity(labels: string[]): AcuityLevel | null {
  let best: AcuityLevel | null = null;
  let bestScore = 5;
  for (const label of labels) {
    const tile = COMPLAINT_TILES.find((t) => t.label === label);
    if (tile?.suggestedAcuity) {
      const score = ACUITY_SEVERITY[tile.suggestedAcuity];
      if (score < bestScore) {
        best = tile.suggestedAcuity;
        bestScore = score;
      }
    }
  }
  return best;
}

function formatDisplayName(lastName: string, firstName: string): string {
  const last = lastName.trim();
  const first = firstName.trim();
  if (last && first) return `${last}, ${first.charAt(0).toUpperCase()}${first.slice(1)}`;
  if (last) return last;
  if (first) return first;
  return "";
}

export function CheckInWizard({ onSubmit }: CheckInWizardProps) {
  const [step, setStep] = useState<WizardStep>("identity");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"Male" | "Female" | "Non-binary" | "">("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [allergies, setAllergies] = useState("");
  const [documentsReceived, setDocumentsReceived] = useState<Set<string>>(new Set());

  const [selectedComplaints, setSelectedComplaints] = useState<Set<string>>(new Set());
  const [symptoms, setSymptoms] = useState<Set<Symptom>>(new Set());
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [otherDetail, setOtherDetail] = useState("");
  const [acuity, setAcuity] = useState<AcuityLevel | null>(null);
  const [acuityManual, setAcuityManual] = useState(false);

  const [errors, setErrors] = useState<{ name?: string; complaint?: string; acuity?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [handoffResult, setHandoffResult] = useState<CheckInResult | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<
    { name: string; patient_id: string; complaint: string; time: string }[]
  >([]);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const resetWizard = useCallback(() => {
    setStep("identity");
    setLastName("");
    setFirstName("");
    setAge("");
    setSex("");
    setEmergencyContact("");
    setAllergies("");
    setDocumentsReceived(new Set());
    setSelectedComplaints(new Set());
    setSymptoms(new Set());
    setClinicalNotes("");
    setOtherDetail("");
    setAcuity(null);
    setAcuityManual(false);
    setErrors({});
    setSubmitError(null);
    setHandoffResult(null);
    requestAnimationFrame(() => nameInputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (step === "identity") {
      requestAnimationFrame(() => nameInputRef.current?.focus());
    }
  }, [step]);

  function toggleDocument(id: string) {
    setDocumentsReceived((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleComplaint(label: string) {
    setSelectedComplaints((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      if (!acuityManual) {
        setAcuity(mostCriticalAcuity(Array.from(next)));
      }
      if (errors.complaint) setErrors((p) => ({ ...p, complaint: undefined }));
      return next;
    });
  }

  function toggleSymptom(s: Symptom) {
    setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function handleAcuitySelect(level: AcuityLevel) {
    setAcuity(level);
    setAcuityManual(true);
    if (errors.acuity) setErrors((p) => ({ ...p, acuity: undefined }));
  }

  function buildComplaintString(): string {
    const complaints = Array.from(selectedComplaints);
    const hasOther = complaints.includes("Other");
    const named = complaints.filter((c) => c !== "Other");
    const parts: string[] = [
      ...named,
      ...(hasOther && otherDetail.trim() ? [otherDetail.trim()] : []),
    ];
    if (clinicalNotes.trim()) parts.push(clinicalNotes.trim());
    if (symptoms.size > 0) {
      parts.push(`Symptoms: ${Array.from(symptoms).join(", ")}`);
    }
    return parts.join(" · ");
  }

  function goToComplaint() {
    if (!lastName.trim()) {
      setErrors({ name: "Last name is required." });
      nameInputRef.current?.focus();
      return;
    }
    setErrors({});
    setStep("complaint");
  }

  async function commitToQueue() {
    const complaintStr = buildComplaintString();
    const e: typeof errors = {};
    const hasComplaintTiles = selectedComplaints.size > 0;
    const hasNarrative = clinicalNotes.trim().length > 0;
    if (!hasComplaintTiles && !hasNarrative) {
      e.complaint = "Select a complaint or enter a narrative.";
    }
    if (!acuity) e.acuity = "Select a triage level.";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const displayName = formatDisplayName(lastName, firstName);
    try {
      const result = await onSubmit({
        complaint: complaintStr,
        acuity: acuity!,
        displayName: displayName || undefined,
      });

      console.log("Check-in registration record:", {
        display_name: displayName,
        age: age ? parseInt(age, 10) : null,
        sex: sex || null,
        emergency_contact: emergencyContact || null,
        allergies: allergies || null,
        documents_received: Array.from(documentsReceived),
        symptoms: Array.from(symptoms),
        clinical_notes: clinicalNotes.trim() || null,
      });

      setRecentCheckins((prev) => [
        {
          name: result.display_name,
          patient_id: result.patient_id,
          complaint: complaintStr,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 2),
      ]);
      setHandoffResult(result);
      setStep("handoff");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTextInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (e.key === "Escape") {
        if (step === "complaint") {
          e.preventDefault();
          setStep("identity");
        } else if (step === "handoff") {
          e.preventDefault();
          resetWizard();
        }
        return;
      }

      if (step === "complaint" && !isTextInput) {
        const num = parseInt(e.key, 10);
        if (!Number.isNaN(num) && e.altKey && num >= 1 && num <= 5) {
          e.preventDefault();
          const levels: AcuityLevel[] = [
            "RESUSCITATION",
            "EMERGENT",
            "URGENT",
            "LESS_URGENT",
            "NON_URGENT",
          ];
          handleAcuitySelect(levels[num - 1]);
          return;
        }
        if (e.key === "0" || (num >= 1 && num <= 9)) {
          e.preventDefault();
          const tileIndex = e.key === "0" ? 9 : num - 1;
          if (tileIndex < COMPLAINT_TILES.length) {
            toggleComplaint(COMPLAINT_TILES[tileIndex].label);
          }
          return;
        }
      }

      if (e.key !== "Enter") return;

      if (isTextInput && step !== "identity") return;

      if (step === "identity") {
        e.preventDefault();
        goToComplaint();
      } else if (step === "complaint") {
        e.preventDefault();
        void commitToQueue();
      } else if (step === "handoff") {
        e.preventDefault();
        resetWizard();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, resetWizard, lastName, selectedComplaints, clinicalNotes, otherDetail, acuity, acuityManual, submitting]);

  const submitColor = acuity ? TRIAGE_CONFIG[acuity].color : "#1f2937";
  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface)]">
      <nav
        className="flex flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface-2)]"
        aria-label="Check-in progress"
      >
        {WIZARD_STEPS.map((s, i) => {
          const active = s.id === step;
          const done = i < stepIndex;
          return (
            <div
              key={s.id}
              className={`flex flex-1 items-center justify-center border-b-2 px-2 py-2.5 text-xs font-semibold uppercase tracking-widest ${
                active
                  ? "wizard-step-active border-[var(--text)] text-[var(--text)]"
                  : done
                    ? "border-[var(--status-stable)] text-[var(--status-stable)]"
                    : "border-transparent text-[var(--text-dim)]"
              }`}
            >
              {s.label}
            </div>
          );
        })}
      </nav>

      {submitError && (
        <p
          className="flex-shrink-0 border-b border-[var(--status-critical)] bg-red-50 px-3 py-1 text-[11px] text-[var(--status-critical)]"
          role="alert"
        >
          {submitError}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--surface-2)]">
        {step === "identity" && (
          <CheckInStepIdentity
            lastName={lastName}
            firstName={firstName}
            age={age}
            sex={sex}
            emergencyContact={emergencyContact}
            allergies={allergies}
            documentsReceived={documentsReceived}
            nameInputRef={nameInputRef}
            onLastNameChange={(v) => {
              setLastName(v);
              if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
            }}
            onFirstNameChange={setFirstName}
            onAgeChange={setAge}
            onSexChange={setSex}
            onEmergencyContactChange={setEmergencyContact}
            onAllergiesChange={setAllergies}
            onToggleDocument={toggleDocument}
            error={errors.name}
          />
        )}

        {step === "complaint" && (
          <CheckInStepComplaint
            selectedComplaints={selectedComplaints}
            symptoms={symptoms}
            clinicalNotes={clinicalNotes}
            otherDetail={otherDetail}
            acuity={acuity}
            acuityManual={acuityManual}
            onToggleComplaint={toggleComplaint}
            onToggleSymptom={toggleSymptom}
            onClinicalNotesChange={setClinicalNotes}
            onOtherDetailChange={setOtherDetail}
            onAcuitySelect={handleAcuitySelect}
            errors={errors}
          />
        )}

        {step === "handoff" && handoffResult && (
          <CheckInHandoffPanel
            result={handoffResult}
            recentCheckins={recentCheckins}
            onNextPatient={resetWizard}
          />
        )}
      </div>

      {step !== "handoff" && (
        <footer className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          {step === "identity" && (
            <button
              type="button"
              onClick={goToComplaint}
              disabled={!lastName.trim()}
              className="intake-submit w-full border border-slate-900 bg-slate-900 py-3 text-xs font-bold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-40"
            >
              Next — complaint & triage [Enter]
            </button>
          )}

          {step === "complaint" && (
            <div className="flex gap-px">
              <button
                type="button"
                onClick={() => setStep("identity")}
                className="intake-input flex-1 border border-[var(--border)] bg-[var(--surface-2)] py-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] hover:bg-[var(--surface)]"
              >
                Back [Esc]
              </button>
              <button
                type="button"
                onClick={() => void commitToQueue()}
                disabled={submitting}
                className="intake-submit flex-[2] border py-3 text-xs font-bold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: submitColor, borderColor: submitColor }}
              >
                {submitting ? "Committing…" : "Commit to queue [Enter]"}
              </button>
            </div>
          )}
        </footer>
      )}
    </div>
  );
}
