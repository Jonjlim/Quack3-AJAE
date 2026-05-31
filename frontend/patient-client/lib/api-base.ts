const DEFAULT_API = "http://localhost:8000";
const PRODUCTION_API = "https://api.eroverwatch.tech";
const API_PORT = 8000;

const TUNNEL_HOST_SUFFIXES = [
  ".trycloudflare.com",
  ".loca.lt",
  ".ngrok-free.app",
  ".ngrok.io",
];

function isTunnelHost(hostname: string): boolean {
  return TUNNEL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

function isPrivateLanHost(hostname: string): boolean {
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

/** Same-origin proxy (Next rewrites) — HTTPS dev avoids mixed-content blocks on :8000. */
function useSameOriginProxy(hostname: string, protocol: string): boolean {
  if (isTunnelHost(hostname)) return true;
  if (protocol !== "https:") return false;
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  return isPrivateLanHost(hostname);
}

function resolveApiFromHost(): string | null {
  if (typeof window === "undefined") return null;
  const { hostname } = window.location;
  if (hostname.endsWith(".eroverwatch.tech") || hostname === "eroverwatch.tech") {
    return PRODUCTION_API;
  }
  return null;
}

/** Resolve backend URL — LAN HTTPS + tunnel use same-origin proxy; production uses api.eroverwatch.tech. */
export function getApiBase(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (useSameOriginProxy(hostname, protocol)) {
      return window.location.origin;
    }
    if (fromEnv && fromEnv !== DEFAULT_API) {
      return fromEnv;
    }
    const fromHost = resolveApiFromHost();
    if (fromHost) return fromHost;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${protocol}//${hostname}:${API_PORT}`;
    }
  }

  return fromEnv || DEFAULT_API;
}

export function isMockMode(): boolean {
  if (process.env.NEXT_PUBLIC_USE_MOCK === "true") return true;
  if (resolveApiFromHost()) return false;
  return false;
}

export function getWsBase(): string {
  const apiBase = getApiBase();
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (useSameOriginProxy(hostname, protocol)) {
      return apiBase.replace(/^http/, "ws");
    }
  }
  if (typeof window !== "undefined" && isTunnelHost(window.location.hostname)) {
    return apiBase.replace(/^http/, "ws");
  }
  return apiBase.replace(/^http/, "ws");
}
