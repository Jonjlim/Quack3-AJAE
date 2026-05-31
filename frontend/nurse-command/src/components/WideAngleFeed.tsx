import type { RemoteVideoTrack } from "../hooks/useLiveKitRoom";
import { RemoteVideo } from "./RemoteVideo";

interface WideAngleFeedProps {
  connected: boolean;
  error: string | null;
  remoteVideos: RemoteVideoTrack[];
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WideAngleFeed({
  connected,
  error,
  remoteVideos,
  onConnect,
  onDisconnect,
}: WideAngleFeedProps) {
  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Wide-Angle Feed
        </h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            connected ? "bg-emerald-900 text-emerald-300" : "bg-slate-700 text-slate-400"
          }`}
        >
          {connected ? "Live" : "Offline"}
        </span>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-slate-800">
          {connected && remoteVideos.length > 0 ? (
            <div className="grid h-full w-full grid-cols-1 gap-1 sm:grid-cols-2">
              {remoteVideos.map((video) => (
                <RemoteVideo
                  key={video.identity}
                  track={video.mediaStreamTrack}
                  className="aspect-video w-full rounded-lg bg-slate-900"
                  label={video.identity}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {connected ? "Waiting for patient camera streams…" : "Waiting room camera feed"}
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={connected ? onDisconnect : onConnect}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          {connected ? "Disconnect" : "Connect Feed"}
        </button>
      </div>
    </section>
  );
}
