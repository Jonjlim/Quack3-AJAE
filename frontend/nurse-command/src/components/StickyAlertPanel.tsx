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
    <aside
      className="fixed inset-x-0 top-0 z-50 border-b-2 border-[var(--status-critical)] bg-red-50"
    >
      <div className="mx-auto max-w-7xl px-3 py-2">
        <p className="telemetry-label text-[var(--status-critical)]">
          Critical Alert — Manual Triage Required
        </p>
        <ul className="mt-1 space-y-px">
          {criticalAlerts.map((alert) => (
            <li
              key={alert.alert_id}
              className="flex items-center justify-between gap-3 border border-[var(--status-critical)] bg-[var(--surface)] px-3 py-2"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--status-critical)]">
                  {alert.type.replace(/_/g, " ")}
                </p>
                <p className="text-[11px] text-[var(--text-2)]">{alert.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onAcknowledge(alert.alert_id)}
                className="shrink-0 border border-[var(--status-critical)] bg-[var(--status-critical)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white hover:opacity-90"
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
