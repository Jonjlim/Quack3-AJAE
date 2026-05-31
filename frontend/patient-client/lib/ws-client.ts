import { getApiBase, getWsBase } from "@/lib/api-base";
import { MOCK_QUEUE_STATUS } from "@/lib/mock-data";
import type {
  IntakeRequest,
  IntakeResponse,
  QueueStatus,
  TelemetryEnvelope,
} from "@shared/types/telemetry";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export async function submitIntake(data: IntakeRequest): Promise<IntakeResponse> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    return {
      patient_id: `pat-mock-${Date.now().toString(36).slice(-6)}`,
      queue_position: MOCK_QUEUE_STATUS.queue_position,
      estimated_wait_minutes: MOCK_QUEUE_STATUS.estimated_wait_minutes,
      created_at: new Date().toISOString(),
    };
  }

  const response = await fetch(`${getApiBase()}/api/v1/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Intake failed (${response.status})`);
  }
  return response.json() as Promise<IntakeResponse>;
}

export async function getQueueStatus(patientId: string): Promise<QueueStatus> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    return { ...MOCK_QUEUE_STATUS, patient_id: patientId };
  }

  const response = await fetch(`${getApiBase()}/api/v1/queue/${encodeURIComponent(patientId)}`);
  if (!response.ok) {
    throw new Error(`Queue status failed (${response.status})`);
  }
  return response.json() as Promise<QueueStatus>;
}

export function connectPatientSocket<T = Record<string, unknown>>(
  patientId: string,
  onMessage: (data: TelemetryEnvelope<T>) => void,
): WebSocket | null {
  if (USE_MOCK) return null;

  const ws = new WebSocket(`${getWsBase()}/ws/patient/${encodeURIComponent(patientId)}`);

  ws.onmessage = (event) => {
    try {
      const envelope = JSON.parse(event.data as string) as TelemetryEnvelope<T>;
      onMessage(envelope);
    } catch {
      // ignore malformed messages
    }
  };

  return ws;
}

export function sendHelpRequest(ws: WebSocket, patientId: string): void {
  const envelope: TelemetryEnvelope = {
    version: "1.0",
    type: "ALERT",
    timestamp: new Date().toISOString(),
    payload: {
      patient_id: patientId,
      message: "Immediate help requested",
    },
  };
  ws.send(JSON.stringify(envelope));
}

export function sendCameraStatus(ws: WebSocket, patientId: string, enabled: boolean): void {
  const envelope: TelemetryEnvelope = {
    version: "1.0",
    type: "CAMERA_STATUS",
    timestamp: new Date().toISOString(),
    payload: {
      patient_id: patientId,
      enabled,
    },
  };
  ws.send(JSON.stringify(envelope));
}

/** REST opt-in so rPPG is allowed before the first clip (avoids WebSocket race). */
export async function setCameraEnabled(patientId: string, enabled: boolean): Promise<void> {
  if (USE_MOCK) return;

  const response = await fetch(`${API_BASE}/api/v1/patients/${encodeURIComponent(patientId)}/camera`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId, enabled }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Camera status failed (${response.status})`);
  }
}

export function isMockMode(): boolean {
  return USE_MOCK;
}
