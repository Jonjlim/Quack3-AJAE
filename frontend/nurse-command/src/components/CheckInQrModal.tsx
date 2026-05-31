import { useEffect } from "react";
import QRCode from "react-qr-code";
import { buildPatientQueueUrl } from "../lib/api-base";

interface CheckInQrModalProps {
  displayName: string;
  patientId: string;
  onClose: () => void;
}

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.55)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-labelledby="checkin-qr-title"
      aria-modal="true"
    >
      <div
        className="flex w-full max-w-sm flex-col items-center rounded-xl px-6 py-6"
        style={{ background: "#ffffff", border: "1px solid #e2e8f0", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" }}
      >
        <p id="checkin-qr-title" className="text-sm font-semibold" style={{ color: "#15803d" }}>
          ✓ Check-in successful
        </p>
        <p className="mt-1 text-base font-bold text-slate-800">{displayName}</p>
        <p className="mt-1 text-center text-xs text-slate-500">
          Scan to open the patient queue on their phone
        </p>

        <div
          className="mt-5 rounded-lg p-4"
          style={{ background: "#ffffff", border: "1px solid #e2e8f0" }}
        >
          <QRCode
            value={queueUrl}
            size={200}
            level="M"
            bgColor="#ffffff"
            fgColor="#0f172a"
            title={`Patient queue link for ${patientId}`}
          />
        </div>

        <p className="mt-4 font-mono text-lg font-bold tracking-wide text-slate-800">{patientId}</p>
        <p className="mt-2 break-all text-center font-mono text-[11px] text-slate-400">{queueUrl}</p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "#2563eb" }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
