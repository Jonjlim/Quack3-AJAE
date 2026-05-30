"use client";

interface HelpButtonProps {
  onHelp: () => void;
  disabled?: boolean;
}

export function HelpButton({ onHelp, disabled }: HelpButtonProps) {
  return (
    <button
      type="button"
      onClick={onHelp}
      disabled={disabled}
      className="w-full rounded-xl bg-red-600 px-6 py-5 text-lg font-bold text-white shadow-lg active:bg-red-700 disabled:opacity-50"
    >
      Request Immediate Help
    </button>
  );
}
