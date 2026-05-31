"use client";

import { useState } from "react";
import { Button } from "../ui/Button";
import { BottomSheet } from "../ui/BottomSheet";
import { Surface } from "../ui/Surface";

interface HelpRequestProps {
  onConfirm: () => void;
  disabled?: boolean;
  sent?: boolean;
}

export function HelpRequest({ onConfirm, disabled, sent }: HelpRequestProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  function handleConfirm() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
    onConfirm();
    setSheetOpen(false);
  }

  if (sent) {
    return (
      <Surface className="text-center">
        <p className="font-medium text-ink">A nurse has been notified</p>
        <p className="mt-1 text-sm text-muted">Staff will check on you as soon as they can.</p>
      </Surface>
    );
  }

  return (
    <>
      <Button
        fullWidth
        variant="danger"
        disabled={disabled}
        onClick={() => setSheetOpen(true)}
      >
        I need help from a nurse
      </Button>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Request nurse assistance">
        <p className="text-sm leading-relaxed text-muted">
          A nurse will be notified that you need attention in the waiting room. For a
          life-threatening emergency, tell staff immediately or call 911.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <Button fullWidth variant="danger" onClick={handleConfirm}>
            Notify a nurse
          </Button>
          <Button fullWidth variant="ghost" onClick={() => setSheetOpen(false)}>
            Cancel
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
