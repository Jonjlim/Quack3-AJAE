type BadgeTone = "live" | "offline" | "mock" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  pulse?: boolean;
  title?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  live: "bg-calm/15 text-calm border border-calm/25",
  offline: "bg-neutral-100 text-muted border border-neutral-200",
  mock: "bg-neutral-100 text-muted border border-neutral-200",
  neutral: "bg-neutral-100 text-muted border border-neutral-200",
};

export function Badge({ children, tone = "neutral", pulse = false, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]} ${pulse && tone === "offline" ? "opacity-80" : ""}`}
    >
      {tone === "live" && (
        <span className="h-1.5 w-1.5 rounded-full bg-calm" aria-hidden />
      )}
      {children}
    </span>
  );
}
