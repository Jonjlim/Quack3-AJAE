"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export function BottomSheet({ open, onClose, children, title }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "sheet-title" : undefined}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-xl border border-neutral-200 bg-surface px-5 pb-8 pt-5 shadow-lg transition-transform"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200" aria-hidden />
        {title && (
          <h2 id="sheet-title" className="text-section-title mb-3">
            {title}
          </h2>
        )}
        {children}
      </div>
    </>
  );
}
