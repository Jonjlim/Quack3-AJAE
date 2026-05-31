type BadgeTone = "live" | "offline" | "mock" | "neutral";

interface BadgeProps {
  children: React.ReactNode;
  tone?: BadgeTone;
  pulse?: boolean;
  title?: string;
}

const toneClasses: Record<BadgeTone, string> = {
  live: "bg-calm/10 text-calm border border-calm/25",
  offline: "bg-surface-2 text-muted border border-border",
  mock: "bg-surface-2 text-muted border border-border",
  neutral: "bg-surface-2 text-muted border border-border",
};

export function Badge({ children, tone = "neutral", pulse = false, title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${toneClasses[tone]} ${pulse && tone === "offline" ? "opacity-80" : ""}`}
    >
      {tone === "live" && (
        <span className="h-1.5 w-1.5 rounded-full bg-calm" aria-hidden />
      )}
      {children}
    </span>
  );
}
