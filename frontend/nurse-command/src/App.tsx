import { useMemo, useState } from "react";
import { BiometricModal } from "./components/BiometricModal";
import { PatientGrid } from "./components/PatientGrid";
import { WideAngleFeed } from "./components/WideAngleFeed";
import { useTriageSocket } from "./hooks/useTriageSocket";
import { CheckInTab } from "./pages/CheckInPage";

type Tab = "dashboard" | "checkin";

function TabButton({
  active,
  onClick,
  children,
  alertCount = 0,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  alertCount?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative px-4 py-2 text-sm font-semibold transition-colors"
      style={{
        color: active ? "white" : "#64748b",
        borderBottom: active ? "2px solid #3b82f6" : "2px solid transparent",
      }}
    >
      {children}
      {alertCount > 0 && !active && (
        <span
          className="alert-badge-pulse absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ background: "#E24B4A" }}
        >
          {alertCount}
        </span>
      )}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");

  const {
    patients,
    activeAlerts,
    connected,
    isMock,
    acknowledgeAlert,
    selectedPatient,
    setSelectedPatient,
    latestBiometric,
    hrHistory,
    demoMode,
    setDemoMode,
    escalatePatient,
    markStable,
    addPatient,
  } = useTriageSocket();

  const alertCountByPatient = useMemo(() => {
    const map: Record<string, number> = {};
    for (const alert of activeAlerts) {
      if (alert.patient_id && !alert.acknowledged) {
        map[alert.patient_id] = (map[alert.patient_id] ?? 0) + 1;
      }
    }
    return map;
  }, [activeAlerts]);

  const unackedAlerts = activeAlerts.filter((a) => !a.acknowledged);
  const hasCritical = unackedAlerts.some(
    (a) => a.severity === "CRITICAL" || a.severity === "HIGH",
  );

  const statusLabel = isMock ? "◆ Mock Mode" : connected ? "● Telemetry Live" : "○ Offline";
  const statusClass = isMock
    ? "bg-slate-700 text-slate-300"
    : connected
      ? "bg-emerald-900 text-emerald-300"
      : "bg-slate-800 text-slate-500";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-white">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 px-5">
        {/* Left: branding + tabs */}
        <div className="flex items-center gap-6">
          <div className="py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">ER-OVERWATCH</p>
            <h1 className="text-base font-bold leading-tight">Nurse Command Center</h1>
          </div>

          <nav className="flex items-end self-stretch gap-1">
            <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
              Dashboard
            </TabButton>
            <TabButton
              active={tab === "checkin"}
              onClick={() => setTab("checkin")}
            >
              + Check In Patient
            </TabButton>
          </nav>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDemoMode(!demoMode)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              demoMode
                ? "bg-amber-700 text-amber-100 ring-1 ring-amber-500"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            }`}
          >
            {demoMode ? "⚡ Demo: ON" : "Demo Mode"}
          </button>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
      </header>

      {/* Body: shared right alert panel + tab content */}
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        {/* Tab content */}
        {tab === "dashboard" ? (
          <>
            <PatientGrid
              patients={patients}
              selectedPatientId={selectedPatient?.patient_id ?? null}
              onSelect={setSelectedPatient}
              hrHistory={hrHistory}
              alertCountByPatient={alertCountByPatient}
            />
            <div className="min-w-0 flex-1">
              <WideAngleFeed />
            </div>
          </>
        ) : (
          <CheckInTab onSubmit={addPatient} />
        )}

        {/* Right — alert panel (always visible on both tabs) */}
        <aside className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-slate-700 bg-slate-900">
          <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <h2
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: hasCritical ? "#E24B4A" : "#94a3b8" }}
            >
              {hasCritical ? "⚠ Critical alerts" : "Active alerts"}
            </h2>
            {unackedAlerts.length > 0 && (
              <span
                className={`rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white ${hasCritical ? "alert-badge-pulse" : ""}`}
              >
                {unackedAlerts.length}
              </span>
            )}
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {unackedAlerts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-600">No active alerts</p>
            ) : (
              unackedAlerts.map((alert) => {
                const patientName = alert.patient_id
                  ? (patients.find((p) => p.patient_id === alert.patient_id)?.display_name ?? alert.patient_id)
                  : null;
                return (
                  <div
                    key={alert.alert_id}
                    className="rounded-lg border p-3"
                    style={{ background: "#160a0a", borderColor: "#E24B4A40" }}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white">
                        {alert.type.replace(/_/g, " ")}
                      </p>
                      {patientName && (
                        <span className="shrink-0 font-mono text-xs text-slate-400">{patientName}</span>
                      )}
                    </div>
                    <p className="mb-1 text-xs text-slate-400">{alert.message}</p>
                    <p className="mb-2 text-xs text-slate-600">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </p>
                    <button
                      type="button"
                      onClick={() => acknowledgeAlert(alert.alert_id)}
                      className="w-full rounded py-1 text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{ background: "#E24B4A20", color: "#E24B4A", border: "1px solid #E24B4A40" }}
                    >
                      Acknowledge
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      <BiometricModal
        patient={selectedPatient}
        hrHistory={hrHistory}
        latestBiometric={latestBiometric}
        onClose={() => setSelectedPatient(null)}
        onEscalate={escalatePatient}
        onMarkStable={markStable}
      />
    </div>
  );
}
