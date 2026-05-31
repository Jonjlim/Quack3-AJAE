/**
 * CasefileReportModal — generates + displays the Gemini case-file report for a patient.
 *
 * Opened from BiometricModal. Shows a loading state, then the formatted report
 * with a "Download PDF" button.
 */

import { useEffect, useState } from "react";
import { getReportMarkdown, getReportPdfUrl } from "../lib/casefile-api";

interface CasefileReportModalProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
}

/** Very simple markdown → JSX renderer (handles ##, -, bold, plain text). */
function renderMarkdown(md: string): React.ReactNode[] {
  return md.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;

    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={i} className="mb-1 mt-4 text-sm font-bold uppercase tracking-wide" style={{ color: "#60a5fa" }}>
          {trimmed.slice(3)}
        </h3>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <h2 key={i} className="mb-2 mt-4 text-base font-bold text-white">
          {trimmed.slice(2)}
        </h2>
      );
    }
    if (trimmed.startsWith("- ")) {
      return (
        <p key={i} className="ml-3 text-sm text-slate-300">
          • {trimmed.slice(2)}
        </p>
      );
    }
    return (
      <p key={i} className="text-sm leading-relaxed text-slate-300">
        {trimmed}
      </p>
    );
  });
}

export function CasefileReportModal({ patientId, patientName, onClose }: CasefileReportModalProps) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch report on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    getReportMarkdown(patientId)
      .then(setMarkdown)
      .catch((err) => setError(err instanceof Error ? err.message : "Report generation failed"))
      .finally(() => setLoading(false));
  }, [patientId]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl"
        style={{ background: "#0d1526", border: "2px solid #3b82f640" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ background: "#111d33", borderBottom: "1px solid #1e293b" }}
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">
              Case File Report
            </p>
            <p className="mt-0.5 text-sm font-bold text-white">
              {patientName} <span className="font-mono text-xs text-slate-500">({patientId})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-700 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              <p className="text-sm text-slate-400">Generating case file with Gemini…</p>
              <p className="text-xs text-slate-600">This may take a few seconds</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg px-4 py-3" style={{ background: "#E24B4A15", border: "1px solid #E24B4A30" }}>
              <p className="text-sm font-medium text-red-400">{error}</p>
            </div>
          )}

          {markdown && !loading && (
            <div>{renderMarkdown(markdown)}</div>
          )}
        </div>

        {/* Actions */}
        {markdown && !loading && (
          <div className="flex gap-3 border-t border-slate-800 px-5 py-4">
            <a
              href={getReportPdfUrl(patientId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg py-2 text-center text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "#3b82f618",
                color: "#60a5fa",
                border: "1px solid #3b82f645",
              }}
            >
              Download PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "#1e293b",
                color: "#94a3b8",
                border: "1px solid #334155",
              }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
