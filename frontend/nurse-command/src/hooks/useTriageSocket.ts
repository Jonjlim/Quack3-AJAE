import { useCallback, useEffect, useState } from "react";
import type {
  AlertEvent,
  BiometricReading,
  PatientRecord,
  TelemetryEnvelope,
} from "@shared/types/telemetry";
import mockPatients from "../mock/patients.json";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface TriageSocketState {
  patients: PatientRecord[];
  activeAlerts: AlertEvent[];
  connected: boolean;
}

export function useTriageSocket(): TriageSocketState & {
  acknowledgeAlert: (alertId: string) => Promise<void>;
  selectedPatient: PatientRecord | null;
  setSelectedPatient: (patient: PatientRecord | null) => void;
  latestBiometric: BiometricReading | null;
} {
  const [patients, setPatients] = useState<PatientRecord[]>(mockPatients as PatientRecord[]);
  const [activeAlerts, setActiveAlerts] = useState<AlertEvent[]>([]);
  const [connected, setConnected] = useState(USE_MOCK);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [latestBiometric, setLatestBiometric] = useState<BiometricReading | null>(null);

  useEffect(() => {
    if (USE_MOCK) return;

    const ws = new WebSocket(`${API_BASE.replace("http", "ws")}/ws/nurse`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data as string) as TelemetryEnvelope;
        if (envelope.type === "PATIENTS_SNAPSHOT") {
          const payload = envelope.payload as { patients: PatientRecord[] };
          setPatients(payload.patients);
        } else if (envelope.type === "PATIENT_UPDATE") {
          const updated = envelope.payload as PatientRecord;
          setPatients((prev) =>
            prev.map((p) => (p.patient_id === updated.patient_id ? updated : p)),
          );
        } else if (envelope.type === "ALERT") {
          const alert = envelope.payload as AlertEvent;
          setActiveAlerts((prev) => [alert, ...prev.filter((a) => a.alert_id !== alert.alert_id)]);
        } else if (envelope.type === "BIOMETRIC") {
          setLatestBiometric(envelope.payload as BiometricReading);
        }
      } catch {
        // ignore malformed messages
      }
    };

    return () => ws.close();
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    if (!USE_MOCK) {
      await fetch(`${API_BASE}/api/v1/alerts/${alertId}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurse_id: "nurse-01" }),
      });
    }
    setActiveAlerts((prev) => prev.filter((a) => a.alert_id !== alertId));
  }, []);

  return {
    patients,
    activeAlerts,
    connected,
    acknowledgeAlert,
    selectedPatient,
    setSelectedPatient,
    latestBiometric,
  };
}
