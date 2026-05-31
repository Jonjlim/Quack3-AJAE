import { patientSafeStatus } from "@/lib/camera-status-copy";

interface VitalsPillProps {
  status: string;
}

export function VitalsPill({ status }: VitalsPillProps) {
  const { headline, sub } = patientSafeStatus(status);
  const showHr = headline.includes("bpm") && /^\d+/.test(headline.trim());

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
      {showHr ? (
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums text-ink">
            {headline.replace(" bpm", "")}
          </span>
          <div>
            <p className="text-sm font-medium text-muted">Heart rate (bpm)</p>
            {sub && <p className="text-sm text-muted">{sub}</p>}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium text-ink">{headline}</p>
          {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        </div>
      )}
    </div>
  );
}
