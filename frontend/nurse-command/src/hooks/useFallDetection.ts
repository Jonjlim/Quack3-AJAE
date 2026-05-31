import { useEffect, useRef, useState } from "react";
import { createBrowserFallDetector } from "../lib/browserFallDetector";
import { reportBrowserFall } from "../lib/report-browser-fall";

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
  roomName?: string | null,
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
        const label = roomName?.trim();
        await reportBrowserFall(
          {
            confidence: event.confidence,
            danger_level: event.danger_level,
            coordinates: event.coordinates ?? null,
            frame_timestamp: event.frame_timestamp ?? null,
            message: label
              ? event.phase === "collapsed"
                ? `Possible unconscious person in ${label}`
                : `Person falling in ${label}`
              : event.phase === "collapsed"
                ? "Possible unconscious person detected"
                : "Person falling detected",
          },
          label ? `room-cam:${label}` : "room-camera-device",
        );
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
  }, [enabled, stream, canvasRef, roomName]);

  return { cvReady };
}
