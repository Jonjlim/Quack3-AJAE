import { getApiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth-fetch";
import { getIdToken, isFirebaseAuthEnabled } from "@/lib/firebase";

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  if (!part) return {};
  const padded = part.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(padded);
  return JSON.parse(json) as Record<string, unknown>;
}

/** Firebase custom claims can lag after link-patient — wait before opening the patient WebSocket. */
export async function waitForPatientClaims(
  patientId: string,
  maxAttempts = 10,
): Promise<void> {
  if (!isFirebaseAuthEnabled()) return;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = await getIdToken(true);
    if (token) {
      const claims = decodeJwtPayload(token);
      if (claims.role === "patient" && claims.patient_id === patientId) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 150));
  }

  throw new Error(
    "Could not confirm your session. Refresh the page or ask the nurse to verify your patient ID.",
  );
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }
  } catch {
    // ignore JSON parse errors
  }
  return fallback;
}

export async function linkPatientSession(patientId: string): Promise<void> {
  if (!isFirebaseAuthEnabled()) return;

  const response = await authFetch(`${getApiBase()}/api/v1/auth/link-patient`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId }),
  });
  if (!response.ok) {
    const fallback = `Failed to link patient session (${response.status}). Check backend logs and Firebase service account.`;
    throw new Error(await readApiError(response, fallback));
  }
  await getIdToken(true);
}

/** Call before opening the patient WebSocket (after link-patient). */
export async function ensurePatientSession(patientId: string): Promise<void> {
  if (!isFirebaseAuthEnabled()) return;
  await waitForPatientClaims(patientId);
}
