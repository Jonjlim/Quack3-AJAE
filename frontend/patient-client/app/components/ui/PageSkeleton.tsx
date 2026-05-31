export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      <div className="h-40 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
      <div className="h-48 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
      <div className="h-36 animate-pulse rounded-xl border border-neutral-200 bg-neutral-100" />
    </div>
  );
}
