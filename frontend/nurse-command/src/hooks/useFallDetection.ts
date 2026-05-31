/**
 * Room-camera fall detection — snapshot mode OR video-clip mode.
 *
 * **Snapshot mode** (default, unchanged from before):
 *   Every second a JPEG snapshot is captured and POSTed to
 *   `POST /api/v1/alerts/analyze-snapshot`.  The backend's rolling buffer
 *   selects 4 frames spanning 9 seconds and sends them to Gemini.
 *
 * **Video mode**:
 *   A MediaRecorder continuously records the camera stream.  Every
 *   SEND_INTERVAL_MS (2 s) the most recent ~CLIP_DURATION_MS (5 s) of
 *   footage is sliced into a webm Blob and POSTed to
 *   `POST /api/v1/alerts/analyze-video`.  Gemini receives native video
 *   rather than sampled stills — significantly more robust.
 *
 * Both modes share the same concurrency guard: if the previous Gemini
 * request hasn't finished, the next tick is skipped.
 */

import { useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/auth-fetch";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Snapshot mode constants ─────────────────────────────────────────────────
/** Pixels wide for the snapshot sent to Gemini (height scales with aspect ratio). */
const SNAPSHOT_WIDTH = 960;
/** Milliseconds between snapshot captures. */
const CAPTURE_INTERVAL_MS = 1_000;
/** JPEG quality (0–1). 0.85 preserves enough detail to spot distant/small people. */
const JPEG_QUALITY = 0.85;

// ── Video mode constants ────────────────────────────────────────────────────
/** How long each recorded clip spans (milliseconds). */
const CLIP_DURATION_MS = 5_000;
/** How often we send a clip to the backend (milliseconds). */
const SEND_INTERVAL_MS = 2_000;

export type FallDetectionMode = "snapshot" | "video";

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
 * Runs fall detection on the given camera stream — either snapshot-based
 * or video-clip-based depending on `mode`.
 *
 * @param stream   - MediaStream from useBroadCameraPublisher.
 * @param enabled  - Capture only runs while true (e.g. isLive).
 * @param roomName - Room label included in alert messages.
 * @param mode     - "snapshot" (4-frame images) or "video" (MediaRecorder clips).
 * @returns `{ cvReady }` — true once the first payload has been sent.
 */
export function useFallDetection(
  stream: MediaStream | null,
  enabled: boolean,
  roomName?: string | null,
  mode: FallDetectionMode = "snapshot",
): { cvReady: boolean } {
  const [cvReady, setCvReady] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Tear down previous loop if any
    cleanupRef.current?.();
    cleanupRef.current = null;
    setCvReady(false);

    if (!enabled || !stream) return;

    if (mode === "video") {
      cleanupRef.current = startVideoMode(stream, roomName ?? null, () => setCvReady(true));
    } else {
      cleanupRef.current = startSnapshotMode(stream, roomName ?? null, () => setCvReady(true));
    }

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setCvReady(false);
    };
  }, [enabled, stream, roomName, mode]);

  return { cvReady };
}

// ─── Snapshot mode ──────────────────────────────────────────────────────────

function startSnapshotMode(
  stream: MediaStream,
  roomName: string | null,
  onFirstSend: () => void,
): () => void {
  const vid = document.createElement("video");
  vid.srcObject = stream;
  vid.muted = true;
  vid.playsInline = true;
  void vid.play().catch(() => undefined);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let firstSent = false;
  let pending = false;

  const timer = setInterval(() => {
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

        return authFetch(`${API_BASE}/api/v1/alerts/analyze-snapshot`, {
          method: "POST",
          body: form,
        }).then((res) => {
          if (!res.ok) console.warn("[snap-fall] rejected:", res.status);
          if (!firstSent) {
            firstSent = true;
            onFirstSend();
          }
        });
      })
      .catch((err) => console.warn("[snap-fall] error:", err))
      .finally(() => {
        pending = false;
      });
  }, CAPTURE_INTERVAL_MS);

  return () => {
    clearInterval(timer);
    vid.pause();
    vid.srcObject = null;
  };
}

// ─── Video mode ─────────────────────────────────────────────────────────────

function startVideoMode(
  stream: MediaStream,
  roomName: string | null,
  onFirstSend: () => void,
): () => void {
  // Choose a supported MIME type for MediaRecorder
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : "video/mp4";

  // Rolling chunk buffer — we keep the last CLIP_DURATION_MS worth of data
  let chunks: Blob[] = [];
  let recorder: MediaRecorder | null = null;
  let stopped = false;

  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 800_000 });
  } catch {
    console.warn("[video-fall] MediaRecorder not supported for", mimeType);
    return () => {};
  }

  // Collect chunks produced by the recorder (fires roughly once per second)
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Start recording with a timeslice so ondataavailable fires periodically
  recorder.start(1_000);

  let firstSent = false;
  let pending = false;

  const sendTimer = setInterval(() => {
    if (stopped || pending || chunks.length === 0) return;

    // Slice out only the last CLIP_DURATION_MS worth of chunks.
    // Each chunk is ~1 s, so keep the last (CLIP_DURATION_MS / 1000) chunks.
    const keepCount = Math.ceil(CLIP_DURATION_MS / 1_000);
    const clipChunks = chunks.slice(-keepCount);

    // Trim the rolling buffer so it doesn't grow forever
    if (chunks.length > keepCount * 2) {
      chunks = chunks.slice(-keepCount);
    }

    const blob = new Blob(clipChunks, { type: mimeType });
    if (blob.size < 1_000) return; // too small to be useful

    pending = true;

    const form = new FormData();
    form.append("video", blob, "clip.webm");
    form.append("mime_type", mimeType.split(";")[0]); // "video/webm"
    const label = roomName?.trim();
    if (label) form.append("room_name", label);

    authFetch(`${API_BASE}/api/v1/alerts/analyze-video`, {
      method: "POST",
      body: form,
    })
      .then((res) => {
        if (!res.ok) console.warn("[video-fall] rejected:", res.status);
        if (!firstSent) {
          firstSent = true;
          onFirstSend();
        }
      })
      .catch((err) => console.warn("[video-fall] error:", err))
      .finally(() => {
        pending = false;
      });
  }, SEND_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(sendTimer);
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    chunks = [];
  };
}
