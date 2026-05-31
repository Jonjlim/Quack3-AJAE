const DEFAULT_API = "http://localhost:8000";
const PRODUCTION_API = "https://api.eroverwatch.tech";
const PRODUCTION_PATIENT_URL = "https://patient.eroverwatch.tech";
const DEFAULT_PATIENT_URL = "https://localhost:3000";

function resolveApiFromHost(): string | null {
  if (typeof window === "undefined") return null;
  const { hostname } = window.location;
  if (hostname.endsWith(".eroverwatch.tech") || hostname === "eroverwatch.tech") {
    return PRODUCTION_API;
  }
  return null;
}

/** REST base — env var wins, then *.eroverwatch.tech convention, then localhost. */
export function getApiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return resolveApiFromHost() ?? DEFAULT_API;
}

export function getWsBase(): string {
  return getApiBase().replace(/^http/, "ws");
}

export function isMockMode(): boolean {
  if (import.meta.env.VITE_USE_MOCK === "true") return true;
  // Never mock on production domain unless explicitly forced above.
  if (resolveApiFromHost()) return false;
  return false;
}

/** Patient PWA base URL for check-in QR codes. */
export function getPatientClientUrl(): string {
  const fromEnv = import.meta.env.VITE_PATIENT_CLIENT_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const { hostname } = window.location;
    if (hostname.endsWith(".eroverwatch.tech") || hostname === "eroverwatch.tech") {
      return PRODUCTION_PATIENT_URL;
    }
  }
  return DEFAULT_PATIENT_URL;
}

export function buildPatientQueueUrl(patientId: string): string {
  return `${getPatientClientUrl()}/queue?patientId=${encodeURIComponent(patientId)}`;
}
