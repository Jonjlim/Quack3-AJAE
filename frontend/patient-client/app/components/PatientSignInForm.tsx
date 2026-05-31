"use client";

import { useState } from "react";

interface PatientSignInFormProps {
  onSignIn: (patientId: string) => Promise<void>;
}

export function PatientSignInForm({ onSignIn }: PatientSignInFormProps) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="patient-id" className="block text-sm font-medium text-slate-700">
          Patient ID
        </label>
        <input
          id="patient-id"
          required
          autoComplete="off"
          spellCheck={false}
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 font-mono text-lg tracking-wide"
          placeholder="e.g. pat-a1b2c3"
        />
        <p className="mt-2 text-sm text-slate-500">
          Your nurse creates your chart and shares this ID with you.
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 px-6 py-5 text-lg font-semibold text-white active:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
