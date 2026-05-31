import type { AcuityLoad } from "@shared/types/telemetry";
import { Surface } from "../ui/Surface";

interface DepartmentStatusProps {
  data: AcuityLoad;
}

function computeLoadPercent(data: AcuityLoad): number {
  const raw = (data.active_traumas * 2 + data.emergent_count) / Math.max(data.total_waiting, 1);
  return Math.min(100, Math.max(0, Math.round(raw * 100)));
}

export function DepartmentStatus({ data }: DepartmentStatusProps) {
  const loadPercent = computeLoadPercent(data);

  return (
    <Surface>
      <h2 className="text-section-title">Emergency department status</h2>
      <p className="mt-1 text-sm text-muted">Overview for patients in the waiting room</p>

      <dl className="mt-5 space-y-4">
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
          <dt className="text-sm text-muted">Patients waiting</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">{data.total_waiting}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
          <dt className="text-sm text-muted">Emergent cases ahead</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">{data.emergent_count}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-sm text-muted">Severe trauma cases</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">{data.active_traumas}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <div className="flex justify-between text-xs text-muted">
          <span>Department activity</span>
          <span>{loadPercent}%</span>
        </div>
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuenow={loadPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${loadPercent}%` }}
          />
        </div>
      </div>

      <p className="mt-4 text-xs text-muted">
        No names or personal details are shown.
      </p>
    </Surface>
  );
}
