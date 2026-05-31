import type { BrowserFallReportRequest } from "@shared/types/telemetry";
import { useEffect, useRef } from "react";
import { createBrowserFallDetector } from "../lib/browserFallDetector";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Runs fall detection in the browser on the given camera stream.
 * When a fall is detected, reports it to triage-engine; alerts appear on the nurse WebSocket.
 */
export function useFallDetection(stream: MediaStream | null, enabled: boolean): void {
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!enabled || !stream) return;

    cleanupRef.current = createBrowserFallDetector(stream, async (event) => {
      const body: BrowserFallReportRequest = {
        confidence: event.confidence,
        danger_level: event.danger_level,
        coordinates: event.coordinates ?? null,
        frame_timestamp: event.frame_timestamp ?? null,
        source: "browser",
      };

      try {
        await fetch(`${API_BASE}/api/v1/alerts/fall-report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        // Nurse dashboard still receives alerts when report succeeds; ignore transient errors
      }
    });

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [enabled, stream]);
}
