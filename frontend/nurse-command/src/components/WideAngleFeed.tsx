import { useMemo } from "react";
import type { RemoteVideoTrack } from "../hooks/useLiveKitRoom";
import { isRoomCameraIdentity } from "../lib/livekit-constants";
import { RemoteVideo } from "./RemoteVideo";

interface WideAngleFeedProps {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  remoteVideos: RemoteVideoTrack[];
  videoLabels?: Record<string, string>;
  onRetry?: () => void;
}

function FeedStatusBadge({
  connected,
  connecting,
}: {
  connected: boolean;
  connecting: boolean;
}) {
  if (connecting) {
    return (
      <span className="rounded-full bg-amber-900/80 px-2 py-0.5 text-xs font-medium text-amber-300">
        Connecting…
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        connected ? "bg-emerald-900 text-emerald-300" : "bg-slate-700 text-slate-400"
      }`}
    >
      {connected ? "Live" : "Offline"}
    </span>
  );
}

export function WideAngleFeed({
  connected,
  connecting,
  error,
  remoteVideos,
  videoLabels = {},
  onRetry,
}: WideAngleFeedProps) {
  const { roomVideos, patientVideos } = useMemo(() => {
    const room: RemoteVideoTrack[] = [];
    const patient: RemoteVideoTrack[] = [];
    for (const video of remoteVideos) {
      if (isRoomCameraIdentity(video.identity)) {
        room.push(video);
      } else {
        patient.push(video);
      }
    }
    return { roomVideos: room, patientVideos: patient };
  }, [remoteVideos]);

  const roomGridClass =
    roomVideos.length <= 1
      ? "grid-cols-1"
      : roomVideos.length === 2
        ? "grid-cols-2"
        : "grid-cols-2 lg:grid-cols-3";

  const hasAnyVideo = remoteVideos.length > 0;

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-slate-700 bg-slate-900">
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Live video
          </h2>
          <FeedStatusBadge connected={connected} connecting={connecting} />
        </div>
        {error && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-600"
          >
            Retry
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-2">
        {/* Room cameras — large presenter stage */}
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg"
          style={{ background: "#0a0f1a", border: "1px solid #312e81" }}
        >
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-indigo-900/50 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
              Room cameras
            </span>
            {roomVideos.length > 0 && (
              <span className="text-[10px] text-slate-500">{roomVideos.length} live</span>
            )}
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
            {connected && roomVideos.length > 0 ? (
              <div
                className={`grid h-full w-full max-h-full gap-3 ${roomGridClass} items-center justify-items-center`}
              >
                {roomVideos.map((video) => (
                  <div
                    key={video.identity}
                    className="flex h-full max-h-full w-full min-h-0 items-center justify-center"
                  >
                    <RemoteVideo
                      feedRole="room"
                      track={video.mediaStreamTrack}
                      className="max-h-full w-full max-w-full rounded-xl"
                      label={videoLabels[video.identity] ?? video.identity}
                      enableCV
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <div className="text-3xl opacity-20">📷</div>
                <p className="text-sm text-slate-500">
                  {connecting
                    ? "Connecting to LiveKit…"
                    : connected
                      ? "Waiting for room cameras — open /camera on a device"
                      : "Room feed offline"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Patient cameras — compact filmstrip */}
        <div
          className="mt-2 flex flex-shrink-0 flex-col overflow-hidden rounded-lg"
          style={{
            background: "#0a0f1a",
            border: "1px solid #1e3a5f",
            maxHeight: patientVideos.length > 0 ? "28%" : "auto",
            minHeight: patientVideos.length > 0 ? 112 : undefined,
          }}
        >
          <div className="flex flex-shrink-0 items-center gap-2 border-b border-sky-900/40 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-sky-400">
              Patient cameras
            </span>
            {patientVideos.length > 0 && (
              <span className="text-[10px] text-slate-500">{patientVideos.length} live</span>
            )}
          </div>

          <div className="flex min-h-[88px] items-center p-2">
            {connected && patientVideos.length > 0 ? (
              <div className="flex w-full gap-2 overflow-x-auto pb-1">
                {patientVideos.map((video) => (
                  <RemoteVideo
                    key={video.identity}
                    feedRole="patient"
                    track={video.mediaStreamTrack}
                    className="aspect-video h-20 w-32 flex-shrink-0 rounded-md sm:h-24 sm:w-40"
                    label={videoLabels[video.identity] ?? video.identity}
                  />
                ))}
              </div>
            ) : (
              <p className="w-full py-3 text-center text-xs text-slate-600">
                {connected
                  ? hasAnyVideo && roomVideos.length > 0
                    ? "No patient cameras yet"
                    : "Patient streams appear when they enable their camera"
                  : "—"}
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="flex-shrink-0 px-1 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
