"use client";

import { useState } from "react";
import type { AcuityLevel, IntakeRequest } from "@shared/types/telemetry";

interface IntakeFormProps {
  onSubmit: (data: IntakeRequest) => Promise<void>;
}

const ACUITY_OPTIONS: AcuityLevel[] = [
  "RESUSCITATION",
  "EMERGENT",
  "URGENT",
  "LESS_URGENT",
  "NON_URGENT",
];

export function IntakeForm({ onSubmit }: IntakeFormProps) {
  const [displayName, setDisplayName] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [acuity, setAcuity] = useState<AcuityLevel>("URGENT");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        display_name: displayName,
        chief_complaint: chiefComplaint,
        acuity_self_report: acuity,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Your name
        </label>
        <input
          id="name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 text-lg"
          placeholder="First name or initials"
        />
      </div>

      <div>
        <label htmlFor="complaint" className="block text-sm font-medium text-slate-700">
          What brings you in today?
        </label>
        <textarea
          id="complaint"
          required
          rows={3}
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 text-lg"
          placeholder="Describe your symptoms"
        />
      </div>

      <div>
        <label htmlFor="acuity" className="block text-sm font-medium text-slate-700">
          How urgent does this feel?
        </label>
        <select
          id="acuity"
          value={acuity}
          onChange={(e) => setAcuity(e.target.value as AcuityLevel)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-4 text-lg"
        >
          {ACUITY_OPTIONS.map((level) => (
            <option key={level} value={level}>
              {level.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 px-6 py-5 text-lg font-semibold text-white active:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Submitting…" : "Check In"}
      </button>
    </form>
  );
}
