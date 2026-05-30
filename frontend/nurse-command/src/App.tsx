import { BiometricModal } from "./components/BiometricModal";
import { PatientGrid } from "./components/PatientGrid";
import { StickyAlertPanel } from "./components/StickyAlertPanel";
import { WideAngleFeed } from "./components/WideAngleFeed";
import { useTriageSocket } from "./hooks/useTriageSocket";

export default function App() {
  const {
    patients,
    activeAlerts,
    connected,
    acknowledgeAlert,
    selectedPatient,
    setSelectedPatient,
    latestBiometric,
  } = useTriageSocket();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <StickyAlertPanel alerts={activeAlerts} onAcknowledge={acknowledgeAlert} />

      <div className={`mx-auto max-w-7xl px-4 py-6 ${activeAlerts.length > 0 ? "pt-32" : "pt-6"}`}>
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">ER-OVERWATCH</p>
            <h1 className="text-2xl font-bold">Nurse Command Center</h1>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              connected ? "bg-emerald-900 text-emerald-300" : "bg-slate-800 text-slate-400"
            }`}
          >
            {connected ? "Telemetry Live" : "Mock Mode"}
          </span>
        </header>

        <div className="grid h-[calc(100vh-10rem)] grid-cols-1 gap-4 lg:grid-cols-2">
          <WideAngleFeed />
          <PatientGrid patients={patients} onSelect={setSelectedPatient} />
        </div>
      </div>

      <BiometricModal
        patient={selectedPatient}
        latestBiometric={latestBiometric}
        onClose={() => setSelectedPatient(null)}
      />
    </div>
  );
}
