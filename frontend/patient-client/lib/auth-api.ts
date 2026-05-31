import { getApiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth-fetch";
import { getIdToken, isFirebaseAuthEnabled } from "@/lib/firebase";

export async function linkPatientSession(patientId: string): Promise<void> {
  if (!isFirebaseAuthEnabled()) return;

  const response = await authFetch(`${getApiBase()}/api/v1/auth/link-patient`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail || `Failed to link patient session (${response.status}). Check backend logs and Firebase service account.`,
    );
  }
  await getIdToken(true);
}
