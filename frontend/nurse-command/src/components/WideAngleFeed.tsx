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
      <span className="border border-amber-600 bg-amber-50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest text-amber-700">
        Connecting
      </span>
    );
  }
  return (
    <span
      className={`border px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest ${
        connected
          ? "border-[var(--status-stable)] text-[var(--status-stable)]"
          : "border-[var(--border)] text-[var(--text-dim)]"
      }`}
    >
      {connected ? "● Live" : "Offline"}
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
  const roomVideos = useMemo(
    () => remoteVideos.filter((video) => isRoomCameraIdentity(video.identity)),
    [remoteVideos],
  );

  const roomGridClass =
    roomVideos.length <= 1
      ? "grid-cols-1"
      : roomVideos.length === 2
        ? "grid-cols-2"
        : "grid-cols-2 lg:grid-cols-3";

  return (
    <section className="panel flex h-full min-h-0 flex-col">
      <header className="panel-header flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="telemetry-label text-[var(--text)]">Optical Sensors</h2>
          <FeedStatusBadge connected={connected} connecting={connecting} />
          {roomVideos.length > 0 && (
            <span className="telemetry-value text-[9px] text-[var(--text-dim)]">
              {roomVideos.length} CH
            </span>
          )}
        </div>
        {error && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-[var(--text)] hover:bg-[var(--surface)]"
          >
            Retry
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-1">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-[var(--border)] bg-black">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            {connected && roomVideos.length > 0 ? (
              <div
                className={`grid h-full w-full max-h-full gap-px bg-[var(--border)] ${roomGridClass} items-center justify-items-center`}
              >
                {roomVideos.map((video) => (
                  <div
                    key={video.identity}
                    className="flex h-full max-h-full w-full min-h-0 items-center justify-center bg-black"
                  >
                    <RemoteVideo
                      feedRole="room"
                      track={video.mediaStreamTrack}
                      className="max-h-full w-full max-w-full"
                      label={videoLabels[video.identity] ?? video.identity}
                      enableCV
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-1.5 py-4 text-center">
                <div className="border border-[var(--border)] px-3 py-2">
                  <p className="telemetry-label text-[var(--text-dim)]">No Signal</p>
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {connecting
                    ? "Establishing LiveKit link…"
                    : connected
                      ? "Awaiting room camera — open /camera on device"
                      : "Feed offline"}
                </p>
                <p className="text-[9px] uppercase tracking-widest text-[var(--text-dim)]">
                  Patient feeds on queue cards
                </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-1 flex-shrink-0 text-[10px] font-medium text-[var(--status-critical)]" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
