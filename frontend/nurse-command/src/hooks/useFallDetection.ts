import type { BrowserFallReportRequest } from "@shared/types/telemetry";
import { useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/auth-fetch";
import { createBrowserFallDetector } from "../lib/browserFallDetector";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Runs MediaPipe pose-based fall detection on the given camera stream.
 * When a fall is detected, reports it to triage-engine; alerts appear on the nurse WebSocket.
 *
 * @param canvasRef - optional canvas element to draw the skeleton overlay onto
 * @returns cvReady - true once the PoseLandmarker model has finished loading
 */
export function useFallDetection(
  stream: MediaStream | null,
  enabled: boolean,
  canvasRef?: React.RefObject<HTMLCanvasElement | null>,
): { cvReady: boolean } {
  const cleanupRef = useRef<(() => void) | null>(null);
  const [cvReady, setCvReady] = useState(false);

  useEffect(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setCvReady(false);

    if (!enabled || !stream) return;

    const { cleanup, ready } = createBrowserFallDetector(
      stream,
      async (event) => {
        const body: BrowserFallReportRequest = {
          confidence: event.confidence,
          danger_level: event.danger_level,
          coordinates: event.coordinates ?? null,
          frame_timestamp: event.frame_timestamp ?? null,
          source: "browser",
        };

        try {
          await authFetch(`${API_BASE}/api/v1/alerts/fall-report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } catch {
          // Nurse dashboard still receives alerts when report succeeds; ignore transient errors
        }
      },
      canvasRef?.current,
    );

    cleanupRef.current = cleanup;
    ready.then(() => setCvReady(true)).catch(() => undefined);

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setCvReady(false);
    };
  }, [enabled, stream, canvasRef]);

  return { cvReady };
}
