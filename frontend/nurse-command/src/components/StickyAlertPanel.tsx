import type { AlertEvent } from "@shared/types/telemetry";

interface StickyAlertPanelProps {
  alerts: AlertEvent[];
  onAcknowledge: (alertId: string) => void;
}

const CRITICAL_SEVERITIES = new Set(["CRITICAL", "HIGH"]);

export function StickyAlertPanel({ alerts, onAcknowledge }: StickyAlertPanelProps) {
  const criticalAlerts = alerts.filter(
    (a) => CRITICAL_SEVERITIES.has(a.severity) && !a.acknowledged,
  );

  if (criticalAlerts.length === 0) return null;

  return (
    <aside className="fixed inset-x-0 top-0 z-50 border-b-2 border-red-500 bg-red-950 shadow-2xl">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-red-300">
          Critical Alerts — Manual Triage Required
        </p>
        <ul className="mt-2 space-y-2">
          {criticalAlerts.map((alert) => (
            <li
              key={alert.alert_id}
              className="flex items-center justify-between gap-4 rounded-lg bg-red-900/80 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-white">{alert.type.replace("_", " ")}</p>
                <p className="text-sm text-red-200">{alert.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onAcknowledge(alert.alert_id)}
                className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-bold text-red-900 hover:bg-red-100"
              >
                Acknowledge
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
