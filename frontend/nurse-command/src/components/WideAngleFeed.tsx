import { useEffect, useRef } from "react";
import type { RemoteVideoTrack } from "../hooks/useLiveKitRoom";
import { RemoteVideo } from "./RemoteVideo";

interface WideAngleFeedProps {
  connected: boolean;
  error: string | null;
  remoteVideos: RemoteVideoTrack[];
  onConnect: () => void;
  onDisconnect: () => void;
  localStream?: MediaStream | null;
  onStartLocalCamera?: () => void;
  onStopLocalCamera?: () => void;
}

export function WideAngleFeed({
  connected,
  error,
  remoteVideos,
  onConnect,
  onDisconnect,
  localStream,
  onStartLocalCamera,
  onStopLocalCamera,
}: WideAngleFeedProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    video.srcObject = localStream ?? null;
  }, [localStream]);

  const hasLocalStream = Boolean(localStream);
  const hasAnyVideo = hasLocalStream || (connected && remoteVideos.length > 0);

  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Wide-angle feed
          </h2>
          {hasLocalStream && (
            <span className="rounded-full bg-emerald-900 px-2 py-0.5 text-xs font-medium text-emerald-300">
              Capturing
            </span>
          )}
          {connected && (
            <span className="rounded-full bg-blue-900 px-2 py-0.5 text-xs font-medium text-blue-300">
              LiveKit Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={hasLocalStream ? onStopLocalCamera : onStartLocalCamera}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors ${
              hasLocalStream
                ? "bg-slate-600 hover:bg-slate-500"
                : "bg-emerald-700 hover:bg-emerald-600"
            }`}
          >
            {hasLocalStream ? "Stop camera" : "Use local camera"}
          </button>
          <button
            type="button"
            onClick={connected ? onDisconnect : onConnect}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            {connected ? "Disconnect" : "Connect feed"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <div
          className="flex w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-lg"
          style={{ background: "#0a0f1a", border: "1px dashed #1e293b" }}
        >
          {hasAnyVideo ? (
            <div className="grid h-full w-full grid-cols-1 gap-1 p-2 sm:grid-cols-2">
              {hasLocalStream && (
                <div className="relative overflow-hidden rounded-lg bg-slate-900">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
                    Room camera
                  </span>
                </div>
              )}
              {connected &&
                remoteVideos.map((video) => (
                  <RemoteVideo
                    key={video.identity}
                    track={video.mediaStreamTrack}
                    className="aspect-video w-full rounded-lg bg-slate-900"
                    label={video.identity}
                  />
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <div className="text-3xl opacity-20">📷</div>
              <p className="text-sm text-slate-600">Wide-angle room feed</p>
              <p className="text-xs text-slate-700">
                Click "Use local camera" to start capturing
              </p>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </section>
  );
}

