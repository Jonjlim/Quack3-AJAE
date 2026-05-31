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
      className="fixed inset-x-0 top-0 z-50 shadow-lg"
      style={{
        background: "rgba(254, 242, 242, 0.96)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "2px solid rgba(220,38,38,0.35)",
      }}
    >
      <div className="mx-auto max-w-7xl px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#E24B4A" }}>
          ⚠ Critical Alert — Manual Triage Required
        </p>
        <ul className="mt-2 space-y-2">
          {criticalAlerts.map((alert) => (
            <li
              key={alert.alert_id}
              className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
              style={{ background: "rgba(226,75,74,0.10)", border: "1px solid rgba(226,75,74,0.22)" }}
            >
              <div>
                <p className="text-sm font-semibold text-white">{alert.type.replace(/_/g, " ")}</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.60)" }}>{alert.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onAcknowledge(alert.alert_id)}
                className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ background: "#E24B4A", color: "white" }}
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
