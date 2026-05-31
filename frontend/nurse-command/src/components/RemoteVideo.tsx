import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/auth-fetch";
import { createNurseFeedDetector } from "../lib/nurseFeedDetector";
import { reportBrowserFall } from "../lib/report-browser-fall";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** How long to wait between event-triggered Gemini clip sends (per room feed). */
const GEMINI_CLIP_COOLDOWN_MS = 30_000;
/** Rolling buffer duration in 1-second chunks. */
const CLIP_MAX_CHUNKS = 6;
const CLIP_MIN_CHUNKS = 3;
const CLIP_CHUNK_MS = 1_000;

function getRecordingMimeType(): string {
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

interface RemoteVideoProps {
  track: MediaStreamTrack;
  className?: string;
  label?: string;
  enableCV?: boolean;
  /** Room feeds are large presenter tiles; patient feeds are compact thumbnails. */
  feedRole?: "room" | "patient";
}

export function RemoteVideo({
  track,
  className = "",
  label,
  enableCV = false,
  feedRole = "patient",
}: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Rolling clip buffer for event-triggered Gemini analysis
  const clipChunksRef = useRef<Blob[]>([]);
  const clipRecorderRef = useRef<MediaRecorder | null>(null);
  const clipMimeTypeRef = useRef<string>("video/webm");
  const lastGeminiClipAtRef = useRef<number>(0);
  // Stable ref to latest label so sendEventClip closure doesn't go stale
  const labelRef = useRef<string | undefined>(label);
  const [cvReady, setCvReady] = useState(false);

  useEffect(() => {
    labelRef.current = label;
  }, [label]);

  /**
   * Immediately POSTs the rolling clip buffer to analyze-clip with the browser
   * confidence score so the backend can fuse both signals.
   * Respects a 30-second per-source cooldown to avoid hammering Gemini.
   */
  const sendEventClip = useCallback(async (browserConfidence: number) => {
    const now = Date.now();
    if (now - lastGeminiClipAtRef.current < GEMINI_CLIP_COOLDOWN_MS) return;
    const snapshot = clipChunksRef.current.slice();
    if (snapshot.length < CLIP_MIN_CHUNKS) return;

    lastGeminiClipAtRef.current = now;
    const mimeType = clipMimeTypeRef.current;
    const blob = new Blob(snapshot, { type: mimeType });
    const form = new FormData();
    form.append("clip", blob, "clip.webm");
    form.append("mime_type", mimeType);
    form.append("browser_confidence", String(browserConfidence));
    const roomLabel = labelRef.current?.trim();
    if (roomLabel) form.append("room_name", roomLabel);

    try {
      const res = await authFetch(`${API_BASE}/api/v1/alerts/analyze-clip`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        lastGeminiClipAtRef.current = 0;
        console.warn("[event-clip] analyze-clip rejected:", res.status);
      }
    } catch (err) {
      lastGeminiClipAtRef.current = 0;
      console.warn("[event-clip] error sending clip:", err);
    }
  }, []);

  const reportFall = useCallback(
    (detail: { confidence: number; state: "falling" | "collapsed" }) => {
      const roomLabel = label?.trim();
      const eventLabel =
        detail.state === "collapsed" ? "Possible unconscious person" : "Person falling";
      void reportBrowserFall(
        {
          confidence: detail.confidence,
          danger_level: detail.state === "collapsed" ? "high" : "medium",
          message: roomLabel
            ? `${eventLabel} in ${roomLabel}`
            : `${eventLabel} in room camera feed`,
        },
        roomLabel ? `dashboard:${roomLabel}` : `dashboard:${track.id}`,
      );
      // Event-triggered: send the rolling buffer to Gemini for confirmation
      void sendEventClip(detail.confidence);
    },
    [label, track.id, sendEventClip],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = new MediaStream([track]);
    return () => {
      video.srcObject = null;
    };
  }, [track]);

  useEffect(() => {
    if (!enableCV) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Wait for the video to start playing before attaching the detector
    const onPlaying = () => {
      const { cleanup, ready } = createNurseFeedDetector(video, canvas, reportFall);
      ready.then(() => setCvReady(true)).catch(() => undefined);
      video.addEventListener("pause", cleanup, { once: true });
      // Store cleanup on the video element so the effect teardown can call it
      (video as HTMLVideoElement & { __cvCleanup?: () => void }).__cvCleanup = cleanup;
    };

    video.addEventListener("playing", onPlaying, { once: true });
    // If already playing (e.g. track resumed), fire immediately
    if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) onPlaying();

    return () => {
      video.removeEventListener("playing", onPlaying);
      const cleanup = (video as HTMLVideoElement & { __cvCleanup?: () => void }).__cvCleanup;
      cleanup?.();
      setCvReady(false);
    };
  }, [enableCV, track, reportFall]);

  // Maintain a rolling clip buffer so MediaPipe events can immediately ship footage
  // to Gemini without waiting for the next polling interval.
  // Only active for room camera feeds where CV is enabled.
  useEffect(() => {
    if (!enableCV || feedRole !== "room") return;

    const stream = new MediaStream([track]);
    const mimeType = getRecordingMimeType();
    clipMimeTypeRef.current = mimeType;
    clipChunksRef.current = [];

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
        clipMimeTypeRef.current = recorder.mimeType || "video/webm";
      } catch (err) {
        console.warn("[event-clip] MediaRecorder unavailable on this track:", err);
        return;
      }
    }

    clipRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        clipChunksRef.current.push(e.data);
        if (clipChunksRef.current.length > CLIP_MAX_CHUNKS) {
          clipChunksRef.current.shift();
        }
      }
    };
    recorder.start(CLIP_CHUNK_MS);

    return () => {
      recorder.ondataavailable = null;
      try {
        recorder.stop();
      } catch {
        // already stopped — ignore
      }
      clipRecorderRef.current = null;
      clipChunksRef.current = [];
    };
  }, [enableCV, feedRole, track]);

  const isRoom = feedRole === "room";

  return (
    <div
      className={`relative overflow-hidden ${
        isRoom
          ? "flex items-center justify-center bg-slate-950 ring-2 ring-violet-500/50"
          : "ring-1 ring-sky-500/35"
      } ${className}`}
    >
      <div
        className={`camera-feed-correct relative ${
          isRoom ? "aspect-video h-full max-h-full w-full max-w-full" : "h-full w-full"
        }`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`h-full w-full ${isRoom ? "object-contain" : "object-cover"}`}
        />
        {enableCV && (
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        )}
      </div>
      <div
        className={`absolute z-10 flex items-center gap-1.5 ${
          isRoom ? "bottom-3 left-3" : "bottom-1.5 left-1.5"
        }`}
      >
        <span
          className={`rounded font-bold uppercase tracking-wide ${
            isRoom
              ? "bg-violet-700/90 px-2 py-0.5 text-[10px] text-violet-100"
              : "bg-sky-800/90 px-1.5 py-px text-[9px] text-sky-100"
          }`}
        >
          {isRoom ? "Room" : "Patient"}
        </span>
        {label && (
          <span
            className={`rounded bg-black/70 text-white ${
              isRoom ? "px-2.5 py-1 text-sm font-semibold" : "px-1.5 py-0.5 text-[10px]"
            }`}
          >
            {label}
          </span>
        )}
        {enableCV && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              cvReady
                ? "bg-violet-900/80 text-violet-300"
                : "animate-pulse bg-slate-800/80 text-slate-500"
            }`}
          >
            {cvReady ? "CV" : "CV…"}
          </span>
        )}
      </div>
    </div>
  );
}
