import { useState } from "react";
import QRCode from "react-qr-code";
import type { CheckInResult } from "../../hooks/useTriageSocket";

const PATIENT_CLIENT_URL =
  import.meta.env.VITE_PATIENT_CLIENT_URL ?? "https://localhost:3000";

export function buildPatientQueueUrl(patientId: string): string {
  return `${PATIENT_CLIENT_URL}/queue?patientId=${encodeURIComponent(patientId)}`;
}

interface RecentCheckin {
  name: string;
  patient_id: string;
  complaint: string;
  time: string;
}

interface CheckInHandoffPanelProps {
  result: CheckInResult;
  recentCheckins: RecentCheckin[];
  onNextPatient: () => void;
}

export function CheckInHandoffPanel({
  result,
  recentCheckins,
  onNextPatient,
}: CheckInHandoffPanelProps) {
  const queueUrl = buildPatientQueueUrl(result.patient_id);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(queueUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-px bg-[var(--border-subtle)] p-px lg:flex-row">
      <div className="flex flex-1 flex-col justify-center bg-[var(--surface)] p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--status-stable)]">
          Committed to queue
        </p>
        <p className="mt-2 text-xl font-semibold text-[var(--text)]">{result.display_name}</p>
        <p className="telemetry-value mt-3 text-3xl font-medium text-[var(--text)]">
          {result.patient_id}
        </p>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Patient scans QR or opens link on their phone to join the waiting room queue.
        </p>

        <button
          type="button"
          onClick={() => void copyLink()}
          className="intake-input mt-4 w-full max-w-sm border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-2)] hover:bg-[var(--surface)]"
        >
          {copied ? "Copied" : "Copy queue link"}
        </button>

        <p className="telemetry-value mt-2 max-w-sm break-all text-[10px] text-[var(--text-dim)]">
          {queueUrl}
        </p>

        {recentCheckins.length > 0 && (
          <div className="mt-6 w-full max-w-sm border-t border-[var(--border-subtle)] pt-4">
            <p className="telemetry-label mb-2">Recent check-ins</p>
            <div className="flex flex-wrap gap-1">
              {recentCheckins.slice(0, 3).map((c) => (
                <span
                  key={c.patient_id}
                  className="telemetry-value border border-[var(--status-stable)] px-2 py-1 text-xs text-[var(--status-stable)]"
                  title={`${c.name} · ${c.complaint} · ${c.time}`}
                >
                  {c.patient_id}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onNextPatient}
          className="intake-submit mt-6 w-full max-w-sm border border-slate-900 bg-slate-900 py-3 text-xs font-bold uppercase tracking-widest text-white hover:opacity-90"
        >
          Check in next patient [Enter]
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center border-l border-[var(--border-subtle)] bg-[var(--surface-2)] p-6">
        <p className="telemetry-label mb-4">Patient queue QR</p>
        <div className="border-2 border-[var(--border)] bg-white p-4">
          <QRCode
            value={queueUrl}
            size={240}
            level="M"
            bgColor="#ffffff"
            fgColor="#111827"
            title={`Patient queue link for ${result.patient_id}`}
          />
        </div>
      </div>
    </div>
  );
}
