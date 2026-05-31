import { useEffect } from "react";
import QRCode from "react-qr-code";
import { buildPatientQueueUrl } from "../lib/api-base";

interface CheckInQrModalProps {
  displayName: string;
  patientId: string;
  onClose: () => void;
}

/** Legacy modal wrapper — prefer inline CheckInHandoffPanel in the wizard. */
export function CheckInQrModal({ displayName, patientId, onClose }: CheckInQrModalProps) {
  const queueUrl = buildPatientQueueUrl(patientId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-labelledby="checkin-qr-title"
      aria-modal="true"
    >
      <div className="panel flex w-full max-w-sm flex-col items-center px-4 py-4">
        <p id="checkin-qr-title" className="text-[10px] font-semibold uppercase tracking-widest text-[var(--status-stable)]">
          Check-in successful
        </p>
        <p className="mt-1 text-sm font-semibold text-[var(--text)]">{displayName}</p>
        <p className="mt-1 text-center text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
          Scan to open patient queue
        </p>

        <div className="mt-4 border border-[var(--border)] bg-white p-3">
          <QRCode
            value={queueUrl}
            size={180}
            level="M"
            bgColor="#ffffff"
            fgColor="#111827"
            title={`Patient queue link for ${patientId}`}
          />
        </div>

        <p className="telemetry-value mt-3 text-base font-medium">{patientId}</p>
        <p className="telemetry-value mt-1 break-all text-center text-[9px] text-[var(--text-dim)]">{queueUrl}</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full border border-slate-800 bg-slate-800 py-2 text-[10px] font-semibold uppercase tracking-widest text-white hover:opacity-90"
        >
          Done
        </button>
      </div>
    </div>
  );
}
