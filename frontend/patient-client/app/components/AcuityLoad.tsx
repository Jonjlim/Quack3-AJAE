import type { AcuityLoad } from "@shared/types/telemetry";

interface AcuityLoadProps {
  data: AcuityLoad;
}

export function AcuityLoad({ data }: AcuityLoadProps) {
  const isHighBurden = data.active_traumas > 2;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">ER Acuity Load</h2>
      <p className="mt-1 text-sm text-slate-500">Anonymized — no patient names shown</p>

      <div className="mt-6 flex items-center gap-3">
        <span
          className={`inline-block h-4 w-4 rounded-full ${
            isHighBurden ? "animate-pulse bg-red-500" : "bg-amber-400"
          }`}
          aria-hidden
        />
        <p className="text-2xl font-bold text-slate-900">
          Processing {data.active_traumas} severe trauma case{data.active_traumas === 1 ? "" : "s"}
        </p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-slate-500">Emergent cases</dt>
          <dd className="text-xl font-semibold">{data.emergent_count}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Total waiting</dt>
          <dd className="text-xl font-semibold">{data.total_waiting}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-500">Estimated wait</dt>
          <dd className="text-xl font-semibold">{data.estimated_wait_minutes} min</dd>
        </div>
      </dl>
    </section>
  );
}
