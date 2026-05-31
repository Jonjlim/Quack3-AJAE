import { getIdToken, isFirebaseAuthEnabled } from "@/lib/firebase";

const DEFAULT_TIMEOUT_MS = 20_000;

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
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (isFirebaseAuthEnabled()) {
    const token = await getIdToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out — the triage server may be busy. Try again in a few seconds.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function wsUrlWithToken(baseUrl: string): Promise<string> {
  if (!isFirebaseAuthEnabled()) return baseUrl;
  const token = await getIdToken();
  if (!token) return baseUrl;
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}token=${encodeURIComponent(token)}`;
}
