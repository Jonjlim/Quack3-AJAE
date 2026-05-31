import { useCallback, useEffect, useRef, useState } from "react";
import { createNurseFeedDetector } from "../lib/nurseFeedDetector";
import { reportBrowserFall } from "../lib/report-browser-fall";

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
  const [cvReady, setCvReady] = useState(false);

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
    },
    [label, track.id],
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
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
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
