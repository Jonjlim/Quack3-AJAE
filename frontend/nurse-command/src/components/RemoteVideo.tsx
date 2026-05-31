import { useEffect, useRef, useState } from "react";
import { createNurseFeedDetector } from "../lib/nurseFeedDetector";

interface RemoteVideoProps {
  track: MediaStreamTrack;
  className?: string;
  label?: string;
  enableCV?: boolean;
}

export function RemoteVideo({ track, className = "", label, enableCV = false }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cvReady, setCvReady] = useState(false);

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
      const { cleanup, ready } = createNurseFeedDetector(video, canvas);
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
  }, [enableCV, track]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      {enableCV && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
        />
      )}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
        {label && (
          <span className="rounded bg-black/60 px-2 py-0.5 text-xs text-white">{label}</span>
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
