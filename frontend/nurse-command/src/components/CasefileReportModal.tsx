/**
 * CasefileReportModal — generates + displays the Gemini case-file report for a patient.
 */

import { useEffect, useState } from "react";
import { getReportMarkdown, getReportPdfUrl } from "../lib/casefile-api";

interface CasefileReportModalProps {
  patientId: string;
  patientName: string;
  onClose: () => void;
}

function renderMarkdown(md: string): React.ReactNode[] {
  return md.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} className="h-2" />;

    if (trimmed.startsWith("## ")) {
      return (
        <h3 key={i} className="telemetry-label mb-1 mt-3 text-[var(--text)]">
          {trimmed.slice(3)}
        </h3>
      );
    }
    if (trimmed.startsWith("# ")) {
      return (
        <h2 key={i} className="mb-1 mt-3 text-sm font-semibold text-[var(--text)]">
          {trimmed.slice(2)}
        </h2>
      );
    }
    if (trimmed.startsWith("- ")) {
      return (
        <p key={i} className="ml-2 text-[11px] text-[var(--text-2)]">
          · {trimmed.slice(2)}
        </p>
      );
    }
    return (
      <p key={i} className="text-[11px] leading-relaxed text-[var(--text-2)]">
        {trimmed}
      </p>
    );
  });
}

export function CasefileReportModal({ patientId, patientName, onClose }: CasefileReportModalProps) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getReportMarkdown(patientId)
      .then(setMarkdown)
      .catch((err) => setError(err instanceof Error ? err.message : "Report generation failed"))
      .finally(() => setLoading(false));
  }, [patientId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="panel w-full max-w-lg overflow-hidden">
        <div className="panel-header flex items-center justify-between">
          <div>
            <p className="telemetry-label">Case File Report</p>
            <p className="mt-0.5 text-sm font-semibold text-[var(--text)]">
              {patientName}{" "}
              <span className="telemetry-value text-[10px] text-[var(--text-muted)]">({patientId})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center border border-[var(--border)] bg-[var(--surface-2)] text-xs text-[var(--text-muted)] hover:bg-[var(--surface)]"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-3">
          {loading && (
            <div className="flex flex-col items-center gap-2 py-8">
              <div className="h-6 w-6 animate-spin border-2 border-[var(--border)] border-t-[var(--text)]" />
              <p className="text-[11px] text-[var(--text-muted)]">Generating case file with Gemini…</p>
              <p className="text-[10px] text-[var(--text-dim)]">This may take a few seconds</p>
            </div>
          )}

          {error && (
            <div className="border border-[var(--status-critical)] bg-red-50 px-3 py-2">
              <p className="text-[11px] font-medium text-[var(--status-critical)]">{error}</p>
            </div>
          )}

          {markdown && !loading && (
            <div>{renderMarkdown(markdown)}</div>
          )}
        </div>

        {markdown && !loading && (
          <div className="flex gap-px border-t border-[var(--border-subtle)] bg-[var(--border-subtle)] p-px">
            <a
              href={getReportPdfUrl(patientId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[var(--surface-2)] py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-[var(--text-2)] hover:bg-[var(--surface)]"
            >
              Download PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-800 bg-slate-800 py-2 text-[10px] font-semibold uppercase tracking-widest text-white hover:opacity-90"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
