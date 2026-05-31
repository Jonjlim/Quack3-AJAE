import { useEffect, useRef } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const CLIP_INTERVAL_MS = 30_000; // start a new clip every 30 seconds
const CLIP_DURATION_MS = 30_000; // each clip is 30 seconds long

function pickMimeType(): string {
  for (const type of ["video/webm;codecs=vp8", "video/webm", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

/**
 * Periodically records 5-second clips from the provided MediaStream and POSTs
 * them to the fall-detection endpoint. Fall alerts come back via the nurse
 * WebSocket — this hook only handles the upload side.
 */
export function useFallDetection(stream: MediaStream | null, enabled: boolean): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || !stream) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const mimeType = pickMimeType();

    const captureAndSend = () => {
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      } catch {
        return;
      }

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: mimeType || "video/webm" });
        const form = new FormData();
        form.append("video", blob, "clip.webm");
        try {
          await fetch(`${API_BASE}/api/v1/scene-intel/fall-detection`, {
            method: "POST",
            body: form,
          });
        } catch {
          // Fall alerts arrive via WebSocket; ignore upload errors silently
        }
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, CLIP_DURATION_MS);
    };

    intervalRef.current = setInterval(captureAndSend, CLIP_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, stream]);
}
