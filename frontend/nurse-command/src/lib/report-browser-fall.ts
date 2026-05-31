import type { BrowserFallReportRequest } from "@shared/types/telemetry";
import { authFetch } from "./auth-fetch";
import { getApiBase } from "./api-base";
const FALL_COOLDOWN_MS = 8_000;

const lastReportAtBySource = new Map<string, number>();

export interface BrowserFallReportPayload {
  confidence: number;
  danger_level: "medium" | "high";
  coordinates?: { x: number; y: number } | null;
  frame_timestamp?: number | null;
  patient_id?: string | null;
  message?: string | null;
}

/**
 * POST fall-report to triage-engine (throttled per sourceKey, e.g. room name).
 * Returns true when the server accepted and broadcast the alert.
 */
export async function reportBrowserFall(
  payload: BrowserFallReportPayload,
  sourceKey = "default",
): Promise<boolean> {
  const now = Date.now();
  const last = lastReportAtBySource.get(sourceKey) ?? 0;
  if (now - last < FALL_COOLDOWN_MS) return false;
  lastReportAtBySource.set(sourceKey, now);

  const body: BrowserFallReportRequest = {
    confidence: payload.confidence,
    danger_level: payload.danger_level,
    coordinates: payload.coordinates ?? null,
    frame_timestamp: payload.frame_timestamp ?? null,
    source: "browser",
    patient_id: payload.patient_id ?? null,
    message: payload.message ?? null,
  };

  try {
    const res = await authFetch(`${getApiBase()}/api/v1/alerts/fall-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      lastReportAtBySource.delete(sourceKey);
      console.warn("[fall-report] rejected", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    lastReportAtBySource.delete(sourceKey);
    console.warn("[fall-report] failed", err);
    return false;
  }
}
