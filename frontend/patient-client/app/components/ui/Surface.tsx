import type { ReactNode } from "react";

interface SurfaceProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}

export function Surface({ children, className = "", as: Tag = "section" }: SurfaceProps) {
  return (
    <Tag
      className={`rounded-2xl border border-border bg-surface p-5 ${className}`}
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
    >
      {children}
    </Tag>
  );
}
