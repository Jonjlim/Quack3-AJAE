interface CalmLoaderProps {
  label?: string;
  className?: string;
}

export function CalmLoader({ label = "Loading", className = "" }: CalmLoaderProps) {
  return (
    <div
      className={`flex items-center justify-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
      {label && <p className="text-sm text-muted">{label}</p>}
    </div>
  );
}
