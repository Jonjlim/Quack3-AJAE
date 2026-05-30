import { useMemo, useState } from "react";
import { BiometricModal } from "./components/BiometricModal";
import { PatientGrid } from "./components/PatientGrid";
import { WideAngleFeed } from "./components/WideAngleFeed";
import { useTriageSocket } from "./hooks/useTriageSocket";
import { CheckInPage } from "./pages/CheckInPage";

export default function App() {
  const [page, setPage] = useState<"dashboard" | "checkin">("dashboard");

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

  const statusLabel = isMock
    ? "◆ Mock Mode"
    : connected
      ? "● Telemetry Live"
      : "○ Offline";

  const statusClass = isMock
    ? "bg-slate-700 text-slate-300"
    : connected
      ? "bg-emerald-900 text-emerald-300"
      : "bg-slate-800 text-slate-500";

  if (page === "checkin") {
    return (
      <CheckInPage
        onSubmit={addPatient}
        onBack={() => setPage("dashboard")}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-white">

      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-800 px-5 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
            ER-OVERWATCH
          </p>
          <h1 className="text-lg font-bold leading-tight">Nurse Command Center</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage("checkin")}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-colors bg-blue-900 text-blue-200 hover:bg-blue-800"
          >
            + Check In Patient
          </button>
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

      {/* 3-column body */}
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        {/* Left — patient priority queue */}
        <PatientGrid
          patients={patients}
          selectedPatientId={selectedPatient?.patient_id ?? null}
          onSelect={setSelectedPatient}
          hrHistory={hrHistory}
          alertCountByPatient={alertCountByPatient}
        />

        {/* Center — wide-angle room feed */}
        <div className="min-w-0 flex-1">
          <WideAngleFeed />
        </div>

        {/* Right — alert stack */}
        <aside
          className={`flex w-72 flex-shrink-0 flex-col rounded-xl border bg-slate-900 ${hasCritical ? "alert-critical-panel" : "border-slate-700"}`}
        >
          <header
            className="flex items-center justify-between border-b px-4 py-3"
            style={{
              borderColor: hasCritical ? "#E24B4A60" : "#334155",
              background: hasCritical ? "#1a0808" : undefined,
            }}
          >
            <h2
              className="text-sm font-semibold uppercase tracking-wide"
              style={{ color: hasCritical ? "#E24B4A" : "#94a3b8" }}
            >
              {hasCritical ? "⚠ Critical Alerts" : "Active Alerts"}
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
                const patientName =
                  alert.patient_id
                    ? (patients.find((p) => p.patient_id === alert.patient_id)?.display_name ??
                      alert.patient_id)
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
                        <span className="shrink-0 font-mono text-xs text-slate-400">
                          {patientName}
                        </span>
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
                      style={{
                        background: "#E24B4A20",
                        color: "#E24B4A",
                        border: "1px solid #E24B4A40",
                      }}
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
