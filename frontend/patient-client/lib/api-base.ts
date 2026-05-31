const DEFAULT_API = "http://localhost:8000";
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

/** Resolve backend URL — LAN uses :8000; tunnel uses same-origin API proxy. */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;
    if (isTunnelHost(hostname)) {
      return window.location.origin;
    }
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `${protocol}//${hostname}:${API_PORT}`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API;
}

export function getWsBase(): string {
  const apiBase = getApiBase();
  if (typeof window !== "undefined" && isTunnelHost(window.location.hostname)) {
    return apiBase.replace(/^http/, "ws");
  }
  return apiBase.replace(/^http/, "ws");
}
