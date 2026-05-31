/**
 * Room-camera fall detection via Gemini dual-snapshot analysis.
 *
 * Every second a JPEG snapshot is captured from the camera stream and sent to
 * POST /api/v1/alerts/analyze-snapshot.  The backend maintains a per-room
 * rolling buffer; once 3 seconds of history have accumulated it compares the
 * current snapshot with the one from 3 seconds ago using Gemini and broadcasts
 * a CRITICAL_FALL alert to nurses when a fall is confirmed.
 *
 * No client-side ML is required — all analysis runs server-side.
 *
 * Concurrency guard: if the previous Gemini request hasn't finished by the
 * time the next snapshot is due, the tick is skipped to avoid pile-up.
 */

import { useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/auth-fetch";
import { getApiBase } from "../lib/api-base";

/** Pixels wide for the snapshot sent to Gemini (height scales with aspect ratio). */
const SNAPSHOT_WIDTH = 960;

/** Milliseconds between snapshot captures. */
const CAPTURE_INTERVAL_MS = 1_000;

/** JPEG quality (0–1). 0.85 preserves enough detail to spot distant/small people. */
const JPEG_QUALITY = 0.85;

/**
 * Capture a JPEG Blob from a video element, scaled to SNAPSHOT_WIDTH.
 * Returns null if the video has no data yet.
 */
function captureFrame(
  vid: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (vid.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !vid.videoWidth) {
      resolve(null);
      return;
    }
    const w = SNAPSHOT_WIDTH;
    const h = Math.round(vid.videoHeight * (w / vid.videoWidth));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    ctx.drawImage(vid, 0, 0, w, h);
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
  });
}

/**
 * Runs snapshot-based fall detection on the given camera stream.
 *
 * @param stream   - MediaStream from useBroadCameraPublisher.
 * @param enabled  - Capture only runs while true (e.g. isLive).
 * @param roomName - Room label included in alert messages.
 * @returns `{ cvReady }` — true once the first snapshot has been sent.
 */
export function useFallDetection(
  stream: MediaStream | null,
  enabled: boolean,
  roomName?: string | null,
): { cvReady: boolean } {
  const [cvReady, setCvReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCvReady(false);

    if (!enabled || !stream) return;

    // Hidden video element — draws from the stream without appearing in the DOM
    const vid = document.createElement("video");
    vid.srcObject = stream;
    vid.muted = true;
    vid.playsInline = true;
    void vid.play().catch(() => undefined);

    // Reusable off-screen canvas for frame capture
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let firstSent = false;
    // True while a request is still in-flight — skip the next tick if so
    let pending = false;

    timerRef.current = setInterval(() => {
      if (pending) return;

      pending = true;
      captureFrame(vid, canvas, ctx)
        .then((blob) => {
          if (!blob) {
            pending = false;
            return;
          }

          const form = new FormData();
          form.append("snapshot", blob, "snap.jpg");
          form.append("mime_type", "image/jpeg");
          const label = roomName?.trim();
          if (label) form.append("room_name", label);

          return authFetch(`${getApiBase()}/api/v1/alerts/analyze-snapshot`, {
            method: "POST",
            body: form,
          }).then((res) => {
            if (!res.ok) console.warn("[snap-fall] rejected:", res.status);
            if (!firstSent) {
              firstSent = true;
              setCvReady(true);
            }
          });
        })
        .catch((err) => console.warn("[snap-fall] error:", err))
        .finally(() => {
          pending = false;
        });
    }, CAPTURE_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      vid.pause();
      vid.srcObject = null;
      setCvReady(false);
    };
  }, [enabled, stream, roomName]);

  return { cvReady };
}
