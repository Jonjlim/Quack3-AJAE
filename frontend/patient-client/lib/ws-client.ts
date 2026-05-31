import { ensurePatientSession, linkPatientSession } from "@/lib/auth-api";
import { authFetch, wsUrlWithToken } from "@/lib/auth-fetch";
import { ensureAnonymousAuth, isFirebaseAuthEnabled } from "@/lib/firebase";
import { getApiBase, getWsBase, isMockMode } from "@/lib/api-base";
import { MOCK_QUEUE_STATUS } from "@/lib/mock-data";
import type { QueueStatus, TelemetryEnvelope } from "@shared/types/telemetry";

const USE_MOCK = isMockMode();

/** Validates the patient exists and links Firebase session before opening queue. */
export async function signInWithPatientId(patientId: string): Promise<QueueStatus> {
  const id = patientId.trim();
  if (!id) {
    throw new Error("Enter the patient ID the nurse gave you.");
  }
  if (isFirebaseAuthEnabled()) {
    await ensureAnonymousAuth();
  }
  const queue = await getQueueStatus(id);
  await linkPatientSession(id);
  return queue;
}

export async function getQueueStatus(patientId: string): Promise<QueueStatus> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200));
    return { ...MOCK_QUEUE_STATUS, patient_id: patientId };
  }

  let response: Response;
  try {
    response = await authFetch(
      `${getApiBase()}/api/v1/queue/${encodeURIComponent(patientId)}`,
    );
  } catch (err) {
    throw new Error(friendlyFetchError(err, "Cannot load queue status."));
  }
  if (response.status === 404) {
    throw new Error("Patient ID not found. Ask the nurse for your ID.");
  }
  if (!response.ok) {
    throw new Error(`Queue status failed (${response.status})`);
  }
  return response.json() as Promise<QueueStatus>;
}

function friendlyFetchError(err: unknown, fallback: string): string {
  if (err instanceof TypeError && /fetch|network|failed/i.test(err.message)) {
    return "Cannot reach the triage server. Make sure the backend is running on port 8000.";
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export async function connectPatientSocket<T = Record<string, unknown>>(
  patientId: string,
  onMessage: (data: TelemetryEnvelope<T>) => void,
): Promise<WebSocket | null> {
  if (USE_MOCK) return null;

  await ensurePatientSession(patientId);

  const url = await wsUrlWithToken(
    `${getWsBase()}/ws/patient/${encodeURIComponent(patientId)}`,
  );
  const ws = new WebSocket(url);

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

  const response = await authFetch(
    `${getApiBase()}/api/v1/patients/${encodeURIComponent(patientId)}/camera`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patientId, enabled }),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Camera status failed (${response.status})`);
  }
}

export { isMockMode } from "@/lib/api-base";
