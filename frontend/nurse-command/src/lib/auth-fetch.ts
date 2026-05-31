import { getIdToken, isFirebaseAuthEnabled } from "./firebase";
import { getApiBase, getWsBase } from "./api-base";

/** Extract a human-readable message from a FastAPI error response. */
export async function readApiError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const body = JSON.parse(text) as { detail?: string };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // not JSON
  }
  return text.trim() || `Request failed (${response.status})`;
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (isFirebaseAuthEnabled()) {
    const token = await getIdToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }
  return fetch(input, { ...init, headers });
}

export async function wsUrlWithToken(path: string): Promise<string> {
  const base = `${getWsBase()}${path}`;
  if (!isFirebaseAuthEnabled()) return base;
  const token = await getIdToken();
  if (!token) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}token=${encodeURIComponent(token)}`;
}

export async function registerNurseSession(): Promise<void> {
  if (!isFirebaseAuthEnabled()) return;
  const response = await authFetch(`${getApiBase()}/api/v1/auth/register-nurse`, {
    method: "POST",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Nurse registration failed (${response.status})`);
  }
  await getIdToken(true);
}
