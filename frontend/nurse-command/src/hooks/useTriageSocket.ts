import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AcuityLevel,
  AlertEvent,
  BiometricReading,
  IntakeResponse,
  PatientRecord,
  TelemetryEnvelope,
} from "@shared/types/telemetry";
import { authFetch, wsUrlWithToken } from "../lib/auth-fetch";
import { MOCK_PATIENTS, MOCK_INITIAL_ALERTS } from "../mock/mockData";

export interface CheckInData {
  complaint: string;
  acuity: AcuityLevel;
  cameraOptIn: boolean;
  displayName?: string;
}

export interface CheckInResult {
  display_name: string;
  patient_id: string;
}

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function generateInitialHistory(patient: PatientRecord): BiometricReading[] {
  const base = patient.last_biometric;
  if (!base || base.heart_rate_bpm == null) return [];
  const hr = base.heart_rate_bpm;
  return Array.from({ length: 5 }, (_, i) => ({
    patient_id: patient.patient_id,
    heart_rate_bpm: Math.round(hr - (4 - i) * (hr * 0.04)),
    respiratory_rate_bpm: base.respiratory_rate_bpm,
    confidence: 0.85,
    source: "rppg" as const,
    recorded_at: new Date(Date.now() - (4 - i) * 120000).toISOString(),
  }));
}

function appendHistory(
  prev: Record<string, BiometricReading[]>,
  patientId: string,
  reading: BiometricReading,
): Record<string, BiometricReading[]> {
  const existing = prev[patientId] ?? [];
  return { ...prev, [patientId]: [...existing.slice(-19), reading] };
}

export function useTriageSocket() {
  const rawPatients = MOCK_PATIENTS;
  const patientCountRef = useRef(rawPatients.length);

  const [patients, setPatients] = useState<PatientRecord[]>(rawPatients);
  const [activeAlerts, setActiveAlerts] = useState<AlertEvent[]>(MOCK_INITIAL_ALERTS);
  const [connected, setConnected] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [latestBiometric, setLatestBiometric] = useState<BiometricReading | null>(null);
  const [hrHistory, setHrHistory] = useState<Record<string, BiometricReading[]>>(() => {
    const init: Record<string, BiometricReading[]> = {};
    for (const p of rawPatients) {
      init[p.patient_id] = generateInitialHistory(p);
    }
    return init;
  });
  const [demoMode, setDemoMode] = useState(false);
  const demoStepRef = useRef(0);

  // Live WebSocket
  useEffect(() => {
    if (USE_MOCK) return;

    let ws: WebSocket | null = null;
    let cancelled = false;

    void wsUrlWithToken("/ws/nurse").then((url) => {
      if (cancelled) return;
      ws = new WebSocket(url);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data as string) as TelemetryEnvelope;
        if (envelope.type === "PATIENTS_SNAPSHOT") {
          const payload = envelope.payload as unknown as { patients: PatientRecord[] };
          setPatients(payload.patients);
        } else if (envelope.type === "PATIENT_UPDATE") {
          const updated = envelope.payload as unknown as PatientRecord;
          setPatients((prev) =>
            prev.map((p) => (p.patient_id === updated.patient_id ? updated : p)),
          );
        } else if (envelope.type === "ALERT") {
          const alert = envelope.payload as unknown as AlertEvent;
          setActiveAlerts((prev) => [alert, ...prev.filter((a) => a.alert_id !== alert.alert_id)]);
        } else if (envelope.type === "BIOMETRIC") {
          const reading = envelope.payload as unknown as BiometricReading;
          setLatestBiometric(reading);
          setHrHistory((prev) => appendHistory(prev, reading.patient_id, reading));
          setPatients((prev) =>
            prev.map((p) =>
              p.patient_id === reading.patient_id ? { ...p, last_biometric: reading } : p,
            ),
          );
        }
      } catch {
        // ignore malformed messages
      }
      };
    });

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, []);

  // Demo mode: simulate P-01 deteriorating
  useEffect(() => {
    if (!demoMode) {
      demoStepRef.current = 0;
      return;
    }

    const id = setInterval(() => {
      demoStepRef.current += 1;
      const step = demoStepRef.current;
      const newHr = Math.min(185, 118 + step * 3 + Math.round((step % 2) * 2));
      const newRr = Math.min(30, 22 + Math.floor(step / 4));

      const reading: BiometricReading = {
        patient_id: "pat-001",
        heart_rate_bpm: newHr,
        respiratory_rate_bpm: newRr,
        confidence: 0.9,
        source: "rppg",
        recorded_at: new Date().toISOString(),
      };

      setLatestBiometric(reading);
      setPatients((prev) =>
        prev.map((p) => (p.patient_id === "pat-001" ? { ...p, last_biometric: reading } : p)),
      );
      setHrHistory((prev) => appendHistory(prev, "pat-001", reading));

      if (step === 8) {
        setActiveAlerts((prev) => [
          {
            alert_id: `demo-fall-${Date.now()}`,
            type: "CRITICAL_FALL",
            severity: "CRITICAL",
            patient_id: "pat-001",
            message: "Fall detected — P-01 in waiting area",
            acknowledged: false,
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    }, 2000);

    return () => clearInterval(id);
  }, [demoMode]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    if (!USE_MOCK) {
      await authFetch(`${API_BASE}/api/v1/alerts/${alertId}/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nurse_id: "nurse-01" }),
      });
    }
    setActiveAlerts((prev) => prev.filter((a) => a.alert_id !== alertId));
  }, []);

  const escalatePatient = useCallback((patientId: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.patient_id === patientId ? { ...p, status: "ESCALATED" as const } : p,
      ),
    );
  }, []);

  const addPatient = useCallback(async (data: CheckInData): Promise<CheckInResult> => {
    patientCountRef.current += 1;
    const num = patientCountRef.current;
    const display_name = data.displayName?.trim() || `P-${String(num).padStart(2, "0")}`;

    if (USE_MOCK) {
      const newPatient: PatientRecord = {
        patient_id: `pat-${String(num).padStart(3, "0")}`,
        display_name,
        queue_position: num,
        acuity: data.acuity,
        status: "WAITING",
        wait_minutes: 0,
        chief_complaint: data.complaint,
        camera_enabled: data.cameraOptIn,
        last_biometric: null,
        created_at: new Date().toISOString(),
      };
      setPatients((prev) => [...prev, newPatient]);
      return { display_name, patient_id: newPatient.patient_id };
    }

    const response = await authFetch(`${API_BASE}/api/v1/intake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name,
        chief_complaint: data.complaint,
        acuity_self_report: data.acuity,
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `Check-in failed (${response.status})`);
    }

    const intake = (await response.json()) as IntakeResponse;
    const patient_id = intake.patient_id;

    if (data.cameraOptIn) {
      await authFetch(`${API_BASE}/api/v1/patients/${encodeURIComponent(patient_id)}/camera`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id, enabled: true }),
      });
    }

    const newPatient: PatientRecord = {
      patient_id,
      display_name,
      queue_position: intake.queue_position,
      acuity: data.acuity,
      status: "WAITING",
      wait_minutes: 0,
      chief_complaint: data.complaint,
      camera_enabled: data.cameraOptIn,
      last_biometric: null,
      created_at: intake.created_at,
    };
    setPatients((prev) => [...prev, newPatient]);
    return { display_name, patient_id };
  }, []);

  const markStable = useCallback((patientId: string) => {
    setPatients((prev) =>
      prev.map((p) =>
        p.patient_id === patientId
          ? { ...p, status: "WAITING" as const, acuity: "LESS_URGENT" as const }
          : p,
      ),
    );
  }, []);

  return {
    patients,
    activeAlerts,
    connected,
    isMock: USE_MOCK,
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
  };
}
