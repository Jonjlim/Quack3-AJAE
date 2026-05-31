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
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ background: "var(--amber-dim)", color: "var(--amber)", border: "1px solid rgba(217,119,6,0.25)" }}
      >
        Connecting…
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={
        connected
          ? { background: "rgba(22,163,74,0.10)", color: "#15803d", border: "1px solid rgba(22,163,74,0.20)" }
          : { background: "rgba(0,0,0,0.05)", color: "var(--text-muted)", border: "1px solid rgba(0,0,0,0.08)" }
      }
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
    <section
      className="flex h-full min-h-0 flex-col"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        borderRadius: "24px",
      }}
    >
      <header
        className="flex flex-shrink-0 items-center justify-between px-4 py-4"
        style={{ borderBottom: "1px solid #e2e8f0" }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>
            Room cameras
          </h2>
          <FeedStatusBadge connected={connected} connecting={connecting} />
          {roomVideos.length > 0 && (
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {roomVideos.length} live
            </span>
          )}
        </div>
        {error && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
            style={{
              background: "#f1f5f9",
              color: "var(--text)",
              border: "1px solid #e2e8f0",
            }}
          >
            Retry
          </button>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl"
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
        >
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2">
            {connected && roomVideos.length > 0 ? (
              <div
                className={`grid h-full w-full max-h-full gap-2 ${roomGridClass} items-center justify-items-center`}
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
                <svg width="40" height="40" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.2 }}>
                  <circle cx="24" cy="24" r="20" stroke="var(--accent)" strokeWidth="1.5" />
                  <circle cx="24" cy="24" r="5" stroke="var(--accent)" strokeWidth="1.5" />
                </svg>
                <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {connecting
                    ? "Connecting to LiveKit…"
                    : connected
                      ? "Waiting for room cameras — open /camera on a device"
                      : "Room feed offline"}
                </p>
                <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                  Patient cameras appear on each patient card and in their detail view
                </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="mt-2 flex-shrink-0 text-xs font-medium" style={{ color: "var(--critical)" }} role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
