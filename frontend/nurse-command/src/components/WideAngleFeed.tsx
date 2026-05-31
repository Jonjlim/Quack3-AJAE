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
    <section className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Wide-angle feed
          </h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              connected ? "bg-emerald-900 text-emerald-300" : "bg-slate-700 text-slate-400"
            }`}
          >
            {connected ? "Live" : "Offline"}
          </span>
        </div>
        <button
          type="button"
          onClick={connected ? onDisconnect : onConnect}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          {connected ? "Disconnect" : "Connect feed"}
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <div
          className="flex w-full flex-1 flex-col items-center justify-center overflow-hidden rounded-lg"
          style={{ background: "#0a0f1a", border: "1px dashed #1e293b" }}
        >
          {connected && remoteVideos.length > 0 ? (
            <div className="grid h-full w-full grid-cols-1 gap-1 p-2 sm:grid-cols-2">
              {remoteVideos.map((video) => (
                <RemoteVideo
                  key={video.identity}
                  track={video.mediaStreamTrack}
                  className="aspect-video w-full rounded-lg bg-slate-900"
                  label={videoLabels[video.identity] ?? video.identity}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <div className="text-3xl opacity-20">📷</div>
              <p className="text-sm text-slate-600">
                {connected ? "Waiting for room or patient camera streams…" : "Wide-angle room feed"}
              </p>
              <p className="text-xs text-slate-700">
                {connected
                  ? "Open /camera on a room device or wait for patient streams"
                  : "Click Connect feed"}
              </p>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </section>
  );
}
