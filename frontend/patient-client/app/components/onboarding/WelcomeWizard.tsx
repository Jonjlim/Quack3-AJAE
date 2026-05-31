"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "../ui/PageShell";
import { Button } from "../ui/Button";
import { Surface } from "../ui/Surface";
import { CalmLoader } from "../ui/CalmLoader";

const PATIENT_ID_KEY = "er-overwatch-patient-id";

interface WelcomeWizardProps {
  onSignIn: (patientId: string) => Promise<unknown>;
}

export function WelcomeWizard({ onSignIn }: WelcomeWizardProps) {
  const router = useRouter();
  const [patientId, setPatientId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const id = patientId.trim();
    if (!id) {
      setError("Enter the patient ID the nurse gave you.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSignIn(id);
      sessionStorage.setItem(PATIENT_ID_KEY, id);
      router.push(`/queue?patientId=${encodeURIComponent(id)}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed. Please try again.";
      setError(
        message.includes("fetch") || message.includes("reach")
          ? "Cannot reach the triage server. Ensure the backend is running (port 8000), then try again."
          : message.includes("not found") || message.includes("404")
            ? "Patient ID not found. Ask the nurse for your ID, or try pat-001 / pat-002 in demo mode."
            : message,
      );
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <Surface>
        <h1 className="text-section-title">Enter your patient ID</h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          After check-in, your nurse creates a chart and gives you a patient ID. Enter it below to
          see your place in line and optional check-in tools.
        </p>

        <form onSubmit={handleSubmit} className="mt-6">
          <label htmlFor="patient-id" className="block text-sm font-medium text-ink">
            Patient ID
          </label>
          <input
            id="patient-id"
            required
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="e.g. pat-a1b2c3"
            className="mt-2 w-full rounded-lg border border-neutral-300 bg-surface px-4 py-4 font-mono text-lg text-ink placeholder:text-neutral-400 focus:border-sage focus:outline-none focus:ring-2 focus:ring-sage/20 disabled:opacity-60"
          />

          {error && (
            <p
              className="mt-4 rounded-lg border border-attention/30 bg-attention/5 px-4 py-3 text-sm text-attention"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="mt-6">
            {loading ? (
              <CalmLoader label="Connecting…" className="py-2" />
            ) : (
              <Button type="submit" fullWidth>
                Continue
              </Button>
            )}
          </div>
        </form>
      </Surface>
    </PageShell>
  );
}
