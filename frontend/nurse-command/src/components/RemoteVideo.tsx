import { useCallback, useEffect, useRef, useState } from "react";
import { createNurseFeedDetector } from "../lib/nurseFeedDetector";
import { reportBrowserFall } from "../lib/report-browser-fall";

interface RemoteVideoProps {
  track: MediaStreamTrack;
  className?: string;
  label?: string;
  enableCV?: boolean;
  feedRole?: "room" | "patient" | "thumbnail";
  objectFit?: "cover" | "contain";
}

export function RemoteVideo({
  track,
  className = "",
  label,
  enableCV = false,
  feedRole = "patient",
  objectFit = "cover",
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

    const onPlaying = () => {
      const { cleanup, ready } = createNurseFeedDetector(video, canvas, reportFall);
      ready.then(() => setCvReady(true)).catch(() => undefined);
      video.addEventListener("pause", cleanup, { once: true });
      (video as HTMLVideoElement & { __cvCleanup?: () => void }).__cvCleanup = cleanup;
    };

    video.addEventListener("playing", onPlaying, { once: true });
    if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) onPlaying();

    return () => {
      video.removeEventListener("playing", onPlaying);
      const cleanup = (video as HTMLVideoElement & { __cvCleanup?: () => void }).__cvCleanup;
      cleanup?.();
      setCvReady(false);
    };
  }, [enableCV, track, reportFall]);

  const isRoom = feedRole === "room";
  const isThumbnail = feedRole === "thumbnail";
  const fitClass = isRoom || objectFit === "contain" ? "object-contain" : "object-cover";

  return (
    <div
      className={`relative overflow-hidden bg-black ${
        isRoom ? "sensor-frame aspect-video h-full max-h-full w-full max-w-full" : isThumbnail ? "h-full w-full" : "border border-[var(--border)]"
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
          className={`h-full w-full ${fitClass}`}
        />
        {enableCV && (
          <canvas
            ref={canvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
        )}
      </div>

      {!isThumbnail && (
        <>
          {/* Top-left: channel ID */}
          <div className={`absolute z-10 ${isRoom ? "left-0 top-0" : "left-0 top-0"}`}>
            <span className="sensor-overlay">
              {isRoom ? "CH·ROOM" : "CH·PT"}
            </span>
          </div>

          {/* Top-right: CV status */}
          {enableCV && (
            <div className="absolute right-0 top-0 z-10">
              <span
                className={`sensor-overlay ${
                  cvReady ? "text-[var(--status-stable)]" : "text-[var(--text-dim)]"
                }`}
              >
                {cvReady ? "CV·ON" : "CV·…"}
              </span>
            </div>
          )}

          {/* Bottom-left: label */}
          {label && (
            <div className={`absolute z-10 ${isRoom ? "bottom-0 left-0" : "bottom-0 left-0"}`}>
              <span className="sensor-overlay telemetry-value max-w-[12rem] truncate">
                {label}
              </span>
            </div>
          )}

          {/* Bottom-right: live indicator for room feeds */}
          {isRoom && (
            <div className="absolute bottom-0 right-0 z-10">
              <span className="sensor-overlay signal-blink text-[var(--status-stable)]">
                ● REC
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
