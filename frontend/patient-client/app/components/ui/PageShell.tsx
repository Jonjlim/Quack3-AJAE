import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className = "" }: PageShellProps) {
  return (
    <div className={`min-h-screen bg-canvas ${className}`}>
      <header className="border-b border-neutral-200 bg-surface px-5 py-4">
        <p className="text-base font-semibold text-ink">ER-OVERWATCH</p>
        <p className="text-sm text-muted">Patient waiting room</p>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-5 py-6 pb-10">
        {children}
      </main>
    </div>
  );
}
