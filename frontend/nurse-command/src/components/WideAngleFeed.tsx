import { useLiveKitRoom } from "../hooks/useLiveKitRoom";

export function WideAngleFeed() {
  const { connected, error, connect, disconnect } = useLiveKitRoom("er-waiting-room", "nurse-01");

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
        <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-slate-800 text-slate-500">
          {connected ? "LiveKit stream placeholder" : "Waiting room camera feed"}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={connected ? disconnect : connect}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          {connected ? "Disconnect" : "Connect Feed"}
        </button>
      </div>
    </section>
  );
}
