import { useEffect, useMemo, useState } from "react";
import { BiometricModal } from "./components/BiometricModal";
import { ManualIntakePanel } from "./components/ManualIntakePanel";
import { PatientGrid } from "./components/PatientGrid";
import { WideAngleFeed } from "./components/WideAngleFeed";
import { useLiveKitRoom } from "./hooks/useLiveKitRoom";
import { useTriageSocket } from "./hooks/useTriageSocket";
import { isRoomCameraIdentity, roomLabelFromIdentity } from "./lib/livekit-constants";
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
      className={`relative px-3 py-1 text-xs font-semibold uppercase tracking-widest border transition-colors ${
        active
          ? "border-slate-800 bg-slate-800 text-white"
          : "border-slate-300 bg-transparent text-slate-500 hover:border-slate-400 hover:text-slate-700"
      }`}
    >
      {children}
      {alertCount > 0 && !active && (
        <span className="alert-badge-pulse absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center bg-red-600 text-[9px] font-bold text-white">
          {alertCount}
        </span>
      )}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [manualIntakeOpen, setManualIntakeOpen] = useState(false);

  const {
    patients,
    activeAlerts,
    connected,
    telemetryError,
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
    removePatient,
    addPatient,
  } = useTriageSocket();

  const allowedPatientIds = useMemo(
    () => new Set(patients.map((p) => p.patient_id)),
    [patients],
  );

  const liveKit = useLiveKitRoom("er-waiting-room", "nurse-01", allowedPatientIds);

  const videoLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const p of patients) {
      labels[p.patient_id] = p.display_name;
    }
    for (const video of liveKit.remoteVideos) {
      if (isRoomCameraIdentity(video.identity)) {
        labels[video.identity] =
          video.displayName || roomLabelFromIdentity(video.identity);
      }
    }
    return labels;
  }, [patients, liveKit.remoteVideos]);
  const patientVideo = selectedPatient
    ? liveKit.getVideoForIdentity(selectedPatient.patient_id)
    : null;

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

  const isLive = !isMock && connected;

  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-GB"));
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB")), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "F2") return;
      if (tab !== "dashboard") return;
      e.preventDefault();
      setManualIntakeOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tab]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">

      <header className="cc-header-stripe flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <div className="flex items-center gap-4">
          <div className="py-1">
            <p className="telemetry-label text-[var(--text-dim)]">ER · Overwatch</p>
            <h1 className="text-sm font-semibold tracking-tight text-[var(--text)]">
              Nurse Command Center
            </h1>
          </div>

          <nav className="flex items-center gap-1">
            <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
              Dashboard
            </TabButton>
            <TabButton active={tab === "checkin"} onClick={() => setTab("checkin")}>
              Check In
            </TabButton>
            <a
              href="/camera"
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-dim)] hover:text-[var(--text-muted)]"
            >
              Room Camera ↗
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {tab === "dashboard" && (
            <button
              type="button"
              onClick={() => setManualIntakeOpen((prev) => !prev)}
              className={`intake-input border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                manualIntakeOpen
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] hover:border-[var(--text-muted)]"
              }`}
              title="Toggle manual intake (F2)"
            >
              Manual Intake [F2]
            </button>
          )}
          <button
            type="button"
            onClick={() => setDemoMode(!demoMode)}
            className={`border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              demoMode
                ? "border-amber-600 bg-amber-50 text-amber-700"
                : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-dim)]"
            }`}
          >
            {demoMode ? "Demo ON" : "Demo"}
          </button>
          <span
            className={`telemetry-value text-[10px] uppercase tracking-wider ${
              isMock
                ? "text-[var(--text-dim)]"
                : isLive
                  ? "text-[var(--status-stable)] signal-blink"
                  : "text-[var(--text-dim)]"
            }`}
          >
            {isMock ? "◆ MOCK" : isLive ? "● LIVE" : "○ OFFLINE"}
          </span>
        </div>
      </header>

      {telemetryError && !isMock && (
        <div
          className="flex-shrink-0 border-b border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800"
          role="alert"
        >
          {telemetryError}
        </div>
      )}

      <div className="flex flex-1 gap-px overflow-hidden bg-[var(--border-subtle)] p-px">
        {tab === "dashboard" ? (
          <>
            <div className="panel flex w-64 flex-shrink-0 flex-col overflow-hidden">
              <ManualIntakePanel
                open={manualIntakeOpen}
                onClose={() => setManualIntakeOpen(false)}
                onSubmit={addPatient}
              />
              <PatientGrid
                patients={patients}
                selectedPatientId={selectedPatient?.patient_id ?? null}
                onSelect={setSelectedPatient}
                alertCountByPatient={alertCountByPatient}
                getVideoForIdentity={liveKit.getVideoForIdentity}
                embedded
              />
            </div>
            <div className="min-w-0 flex-1 bg-[var(--bg)]">
              <WideAngleFeed
                connected={liveKit.connected}
                connecting={liveKit.connecting}
                error={liveKit.error}
                remoteVideos={liveKit.remoteVideos}
                videoLabels={videoLabels}
                onRetry={liveKit.connect}
              />
            </div>
          </>
        ) : (
          <CheckInTab onSubmit={addPatient} className="min-w-0 flex-1" />
        )}

        <aside
          className={`panel flex w-64 flex-shrink-0 flex-col ${hasCritical ? "alert-critical-panel" : ""}`}
        >
          <header className="panel-header flex items-center justify-between">
            <h2
              className={`text-xs font-semibold uppercase tracking-widest ${
                hasCritical ? "text-[var(--status-critical)]" : "text-[var(--text)]"
              }`}
            >
              {hasCritical ? "Alert" : "Alerts"}
            </h2>
            {unackedAlerts.length > 0 && (
              <span
                className={`telemetry-value px-1.5 py-px text-[10px] font-bold text-white ${
                  hasCritical ? "alert-badge-pulse bg-[var(--status-critical)]" : "bg-[var(--status-critical)]"
                }`}
              >
                {unackedAlerts.length}
              </span>
            )}
          </header>

          <div className="flex-1 space-y-px overflow-y-auto bg-[var(--border-subtle)] p-px">
            {unackedAlerts.length === 0 ? (
              <p className="bg-[var(--surface)] py-6 text-center text-[10px] uppercase tracking-widest text-[var(--text-dim)]">
                No active alerts
              </p>
            ) : (
              unackedAlerts.map((alert) => {
                const patientName = alert.patient_id
                  ? (patients.find((p) => p.patient_id === alert.patient_id)?.display_name ??
                    alert.patient_id)
                  : null;
                return (
                  <div
                    key={alert.alert_id}
                    className="border border-[var(--border-subtle)] bg-[var(--surface)] p-2"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--status-critical)]">
                        {alert.type.replace(/_/g, " ")}
                      </p>
                      {patientName && (
                        <span className="shrink-0 border border-red-300 bg-red-50 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-red-700">
                          {patientName}
                        </span>
                      )}
                    </div>
                    <p className="mb-1 text-[11px] text-[var(--text-2)]">{alert.message}</p>
                    <p className="telemetry-value mb-2 text-[10px] text-[var(--text-dim)]">
                      {new Date(alert.created_at).toLocaleTimeString("en-GB")}
                    </p>
                    <button
                      type="button"
                      onClick={() => acknowledgeAlert(alert.alert_id)}
                      className="w-full border border-[var(--status-critical)] bg-[var(--status-critical)] py-1.5 text-[10px] font-semibold uppercase tracking-widest text-white hover:opacity-90"
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

      <footer className="flex flex-shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-3 py-1">
        <div className="flex items-center gap-4">
          <span className="telemetry-label text-[var(--text-dim)]">ER·OVERWATCH</span>
          <span className="text-[10px] text-[var(--text-muted)]">
            <span className="telemetry-value text-[var(--text)]">{patients.length}</span>{" "}
            <span className="uppercase tracking-wider">patients</span>
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            <span
              className={`telemetry-value ${
                unackedAlerts.length > 0 ? "text-[var(--status-critical)]" : "text-[var(--text)]"
              }`}
            >
              {unackedAlerts.length}
            </span>{" "}
            <span className="uppercase tracking-wider">alerts</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="telemetry-label text-[var(--text-dim)]">
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
          </span>
          <span className="telemetry-value text-[10px] font-medium text-[var(--text)]">
            {clock}
          </span>
        </div>
      </footer>

      <BiometricModal
        patient={selectedPatient}
        hrHistory={hrHistory}
        latestBiometric={latestBiometric}
        patientVideo={patientVideo}
        onClose={() => setSelectedPatient(null)}
        onEscalate={escalatePatient}
        onMarkStable={markStable}
        onRemove={(patientId) => void removePatient(patientId)}
      />
    </div>
  );
}
