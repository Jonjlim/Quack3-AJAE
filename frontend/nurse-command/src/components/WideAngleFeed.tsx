import type { RemoteVideoTrack } from "../hooks/useLiveKitRoom";
import { RemoteVideo } from "./RemoteVideo";

interface WideAngleFeedProps {
  connected: boolean;
  error: string | null;
  remoteVideos: RemoteVideoTrack[];
  videoLabels?: Record<string, string>;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WideAngleFeed({
  connected,
  error,
  remoteVideos,
  videoLabels = {},
  onConnect,
  onDisconnect,
}: WideAngleFeedProps) {
  return (
    <section
      className="flex h-full flex-col"
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
        borderRadius: "24px",
      }}
    >
      <header
        className="flex items-center justify-between px-4 py-4"
        style={{ borderBottom: "1px solid #e2e8f0" }}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>
            Room Feed
          </h2>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={connected
              ? { background: "rgba(22,163,74,0.10)", color: "#15803d", border: "1px solid rgba(22,163,74,0.20)" }
              : { background: "rgba(0,0,0,0.05)", color: "var(--text-muted)", border: "1px solid rgba(0,0,0,0.08)" }
            }
          >
            {connected ? "● Live" : "Offline"}
          </span>
        </div>
        <button
          type="button"
          onClick={connected ? onDisconnect : onConnect}
          className="rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
          style={{
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            boxShadow: "0 2px 8px rgba(37,99,235,0.30)",
          }}
        >
          {connected ? "Disconnect" : "Connect"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden p-2">
        <div
          className="relative flex w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-xl"
          style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
        >
          {connected && remoteVideos.length > 0 ? (
            <div
              className={`grid h-full w-full gap-1 p-1 ${
                remoteVideos.length === 1
                  ? "grid-cols-1"
                  : remoteVideos.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3"
              }`}
            >
              {remoteVideos.map((video) => (
                <RemoteVideo
                  key={video.identity}
                  track={video.mediaStreamTrack}
                  className="h-full w-full rounded-lg bg-black"
                  label={videoLabels[video.identity] ?? video.identity}
                  enableCV
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3">
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.20 }}>
                <circle cx="24" cy="24" r="20" stroke="var(--accent)" strokeWidth="1.5"/>
                <circle cx="24" cy="24" r="5" stroke="var(--accent)" strokeWidth="1.5"/>
                <line x1="24" y1="0" x2="24" y2="14" stroke="var(--accent)" strokeWidth="1.5"/>
                <line x1="24" y1="34" x2="24" y2="48" stroke="var(--accent)" strokeWidth="1.5"/>
                <line x1="0" y1="24" x2="14" y2="24" stroke="var(--accent)" strokeWidth="1.5"/>
                <line x1="34" y1="24" x2="48" y2="24" stroke="var(--accent)" strokeWidth="1.5"/>
              </svg>
              <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                {connected ? "Awaiting camera stream…" : "Room camera feed"}
              </p>
              <p className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                {connected ? "Open /camera on a room device" : "Click Connect to start"}
              </p>
            </div>
          )}
        </div>
        {error && <p className="text-xs" style={{ color: "var(--critical)" }}>{error}</p>}
      </div>
    </section>
  );
}
