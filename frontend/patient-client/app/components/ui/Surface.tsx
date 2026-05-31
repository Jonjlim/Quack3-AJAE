import type { ReactNode } from "react";

interface SurfaceProps {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}

export function Surface({ children, className = "", as: Tag = "section" }: SurfaceProps) {
  return (
    <Tag
      className={`rounded-xl border border-neutral-200/80 bg-surface p-5 shadow-sm ${className}`}
    >
      {children}
    </Tag>
  );
}
