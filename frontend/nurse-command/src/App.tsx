import { useEffect, useMemo, useState } from "react";
import { BiometricModal } from "./components/BiometricModal";
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
      className="relative px-5 text-[15px] font-bold transition-all"
      style={{
        paddingTop: "7px",
        paddingBottom: "7px",
        color: active ? "#ffffff" : "#64748b",
        background: active ? "#2563eb" : "#f1f5f9",
        border: active ? "none" : "1px solid #e2e8f0",
        borderRadius: "999px",
        boxShadow: active ? "0 2px 8px rgba(37,99,235,0.25)" : "none",
        textShadow: "none",
        zIndex: active ? 10 : 1,
        alignSelf: "center",
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

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ color: "var(--text)" }}>

      <header
        className="cc-header-stripe flex flex-shrink-0 items-center justify-between px-5 py-3"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center gap-6">
          <div className="py-3">
            <p className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: "var(--accent)" }}>
              ER · Overwatch
            </p>
            <h1 className="text-base font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Nurse Command Center
            </h1>
          </div>

          <nav className="flex items-center gap-2 px-1">
            <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
              Dashboard
            </TabButton>
            <TabButton active={tab === "checkin"} onClick={() => setTab("checkin")}>
              + Check In
            </TabButton>
            <a
              href="/camera"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium transition-colors"
              style={{ color: "#94a3b8" }}
            >
              Room Camera ↗
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDemoMode(!demoMode)}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
            style={demoMode
              ? { background: "var(--accent-dim)", color: "var(--accent)", border: "1px solid rgba(37,99,235,0.25)" }
              : { background: "#f1f5f9", color: "var(--text-muted)", border: "1px solid #e2e8f0" }
            }
          >
            {demoMode ? "⚡ Demo" : "Demo"}
          </button>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={isLive ? "amber-pulse" : ""}
              style={{ color: isMock ? "var(--text-dim)" : isLive ? "var(--accent)" : "var(--text-dim)" }}
            >
              {isMock ? "◆ Mock" : isLive ? "● Live" : "○ Offline"}
            </span>
          </div>
        </div>
      </header>

      {telemetryError && !isMock && (
        <div
          className="flex-shrink-0 px-5 py-2 text-sm font-medium"
          role="alert"
          style={{
            background: "#fffbeb",
            borderBottom: "1px solid #fcd34d",
            color: "#92400e",
          }}
        >
          {telemetryError}
        </div>
      )}

      <div className="flex flex-1 gap-2 overflow-hidden p-2">
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
          <CheckInTab onSubmit={addPatient} />
        )}

        <aside
          className={`flex w-72 flex-shrink-0 flex-col ${hasCritical ? "alert-critical-panel" : ""}`}
          style={{
            background: hasCritical ? "#fef2f2" : "#ffffff",
            border: hasCritical
              ? "1px solid #fca5a5"
              : "1px solid #e2e8f0",
            boxShadow: hasCritical
              ? "0 0 0 2px rgba(220,38,38,0.08), 0 2px 12px rgba(220,38,38,0.10), 0 1px 3px rgba(0,0,0,0.04)"
              : "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
            borderRadius: "24px",
          }}
        >
          <header
            className="flex items-center justify-between px-4 py-4"
            style={{ borderBottom: `1px solid ${hasCritical ? "rgba(220,38,38,0.15)" : "#e2e8f0"}` }}
          >
            <h2
              className="text-base font-black tracking-tight"
              style={{ color: hasCritical ? "#dc2626" : "var(--text)" }}
            >
              {hasCritical ? "🚨 ALERT" : "Alerts"}
            </h2>
            {unackedAlerts.length > 0 && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-black text-white ${hasCritical ? "alert-badge-pulse" : ""}`}
                style={{ background: "#dc2626", boxShadow: hasCritical ? "0 0 12px rgba(220,38,38,0.70)" : "none" }}
              >
                {unackedAlerts.length}
              </span>
            )}
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {unackedAlerts.length === 0 ? (
              <p className="py-8 text-center text-xs" style={{ color: "var(--text-dim)" }}>No active alerts</p>
            ) : (
              unackedAlerts.map((alert) => {
                const patientName = alert.patient_id
                  ? (patients.find((p) => p.patient_id === alert.patient_id)?.display_name ??
                    alert.patient_id)
                  : null;
                return (
                  <div
                    key={alert.alert_id}
                    className="rounded-2xl border p-4"
                    style={{
                      background: "#ffffff",
                      borderColor: "#e2e8f0",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <p className="text-sm font-black uppercase tracking-wide" style={{ color: "#dc2626" }}>
                        {alert.type.replace(/_/g, " ")}
                      </p>
                      {patientName && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(248,113,113,0.20)", color: "#fca5a5" }}>
                          {patientName}
                        </span>
                      )}
                    </div>
                    <p className="mb-1 text-xs font-medium" style={{ color: "var(--text-2)" }}>{alert.message}</p>
                    <p className="mb-3 text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(alert.created_at).toLocaleTimeString("en-GB")}
                    </p>
                    <button
                      type="button"
                      onClick={() => acknowledgeAlert(alert.alert_id)}
                      className="w-full rounded-xl py-2 text-sm font-bold transition-opacity hover:opacity-80"
                      style={{
                        background: "rgba(220,38,38,0.85)",
                        color: "#ffffff",
                        boxShadow: "0 2px 12px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,150,150,0.40)",
                        border: "none",
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

      {/* Bottom status bar */}
      <footer
        className="flex flex-shrink-0 items-center justify-between px-5 py-1.5"
        style={{
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div className="flex items-center gap-6">
          <span className="text-[10px] font-bold tracking-widest" style={{ color: "var(--accent)" }}>
            ER·OVERWATCH
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: "var(--text)" }}>{patients.length}</span> patients
          </span>
          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
            <span style={{ color: unackedAlerts.length > 0 ? "var(--critical)" : "var(--text)" }}>{unackedAlerts.length}</span> alerts
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
          </span>
          <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>
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
      />
    </div>
  );
}
