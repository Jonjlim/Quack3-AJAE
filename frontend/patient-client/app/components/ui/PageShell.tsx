"use client";

import { useEffect, useState, type ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export function PageShell({
  children,
  className = "",
  title = "Patient Portal",
  subtitle = "Waiting room",
}: PageShellProps) {
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-GB"));

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB")), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex min-h-screen flex-col" style={{ color: "var(--text)" }}>
      <header
        className="cc-header-stripe flex-shrink-0 px-5 py-3"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <p
          className="text-[11px] font-bold tracking-[0.12em] uppercase"
          style={{ color: "var(--accent)" }}
        >
          ER · Overwatch
        </p>
        <h1 className="text-base font-bold tracking-tight">{title}</h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>
      </header>

      <main className={`mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-5 pb-8 ${className}`}>
        {children}
      </main>

      <footer
        className="flex flex-shrink-0 items-center justify-between px-5 py-2"
        style={{
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <span className="text-[10px] font-bold tracking-widest" style={{ color: "var(--accent)" }}>
          ER·OVERWATCH
        </span>
        <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>
          {clock}
        </span>
      </footer>
    </div>
  );
}
