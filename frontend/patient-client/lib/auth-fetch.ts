import { getIdToken, isFirebaseAuthEnabled } from "@/lib/firebase";

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

export async function wsUrlWithToken(baseUrl: string): Promise<string> {
  if (!isFirebaseAuthEnabled()) return baseUrl;
  const token = await getIdToken();
  if (!token) return baseUrl;
  const sep = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${sep}token=${encodeURIComponent(token)}`;
}
