/**
 * Room-camera fall detection via backend Gemini video analysis.
 *
 * Records a rolling 10-second buffer of 1-second MediaRecorder chunks.
 * Every 8 seconds the current buffer is assembled into a clip and posted to
 * POST /api/v1/alerts/analyze-clip.  The backend runs scene-intel's Gemini
 * analysis and broadcasts CRITICAL_FALL alerts to nurses directly — no
 * client-side ML inference is required.
 *
 * Clip timing:
 *   • Clips are 10 seconds of context (enough for Gemini to judge a fall).
 *   • Clips are sent every 8 seconds → 2-second overlap between consecutive
 *     clips so no fall event falls entirely in a gap.
 */

import { useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/auth-fetch";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const CHUNK_MS = 1_000;       // MediaRecorder timeslice — one chunk per second
const MAX_CHUNKS = 10;        // keep last 10 chunks → 10-second rolling window
const SEND_INTERVAL_MS = 8_000; // POST a clip every 8 seconds
const MIN_CHUNKS_TO_SEND = 8;  // require at least 8 seconds before first send

function getSupportedMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "video/webm";
}

/**
 * Starts a rolling-buffer MediaRecorder on the given stream and periodically
 * ships 10-second clips to the triage-engine for Gemini fall analysis.
 *
 * @param stream   - Camera MediaStream (from `useBroadCameraPublisher`).
 * @param enabled  - Recording only runs while this is true (e.g. `isLive`).
 * @param roomName - Label included in fall alert messages (e.g. "Triage Bay A").
 * @returns `{ cvReady }` — true once the recorder is running and sending clips.
 */
export function useFallDetection(
  stream: MediaStream | null,
  enabled: boolean,
  roomName?: string | null,
): { cvReady: boolean } {
  const [cvReady, setCvReady] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("video/webm");

  useEffect(() => {
    // Tear down any previous recorder before (re)starting
    if (recorderRef.current) {
      recorderRef.current.ondataavailable = null;
      try {
        recorderRef.current.stop();
      } catch {
        // already stopped — ignore
      }
      recorderRef.current = null;
    }
    if (sendTimerRef.current !== null) {
      clearInterval(sendTimerRef.current);
      sendTimerRef.current = null;
    }
    chunksRef.current = [];
    setCvReady(false);

    if (!enabled || !stream) return;

    // --- Start MediaRecorder ---
    const mimeType = getSupportedMimeType();
    mimeTypeRef.current = mimeType;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
        mimeTypeRef.current = recorder.mimeType || "video/webm";
      } catch (err) {
        console.warn("[clip-fall] MediaRecorder unavailable:", err);
        return;
      }
    }

    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
        // Slide the window — evict the oldest chunk when we exceed MAX_CHUNKS
        if (chunksRef.current.length > MAX_CHUNKS) {
          chunksRef.current.shift();
        }
      }
    };

    recorder.start(CHUNK_MS);
    setCvReady(true);

    // --- Periodic clip dispatch ---
    sendTimerRef.current = setInterval(() => {
      const snapshot = chunksRef.current.slice();
      if (snapshot.length < MIN_CHUNKS_TO_SEND) return;

      const blob = new Blob(snapshot, { type: mimeTypeRef.current });
      const form = new FormData();
      form.append("clip", blob, "clip.webm");
      form.append("mime_type", mimeTypeRef.current);
      const label = roomName?.trim();
      if (label) form.append("room_name", label);

      authFetch(`${API_BASE}/api/v1/alerts/analyze-clip`, {
        method: "POST",
        body: form,
      })
        .then((res) => {
          if (!res.ok) console.warn("[clip-fall] analyze-clip rejected:", res.status);
        })
        .catch((err) => console.warn("[clip-fall] error sending clip:", err));
    }, SEND_INTERVAL_MS);

    return () => {
      if (recorderRef.current) {
        recorderRef.current.ondataavailable = null;
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
        recorderRef.current = null;
      }
      if (sendTimerRef.current !== null) {
        clearInterval(sendTimerRef.current);
        sendTimerRef.current = null;
      }
      chunksRef.current = [];
      setCvReady(false);
    };
  }, [enabled, stream, roomName]);

  return { cvReady };
}
