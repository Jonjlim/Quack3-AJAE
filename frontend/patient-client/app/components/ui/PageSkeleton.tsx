export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <div className="h-40 animate-pulse rounded-2xl border border-border bg-surface-2" />
      <div className="h-48 animate-pulse rounded-2xl border border-border bg-surface-2" />
      <div className="h-36 animate-pulse rounded-2xl border border-border bg-surface-2" />
    </div>
  );
}
