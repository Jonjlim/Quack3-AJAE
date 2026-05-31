export function WideAngleFeed() {
  return (
    <section className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Wide-angle feed
          </h2>
          <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-500">
            Offline
          </span>
        </div>
        <button
          type="button"
          disabled
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors"
          style={{ background: "#1e293b", border: "1px solid #334155", cursor: "not-allowed" }}
          title="LiveKit integration pending"
        >
          Connect feed
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
        <div
          className="flex w-full flex-col items-center justify-center gap-2 rounded-lg py-8"
          style={{ background: "#0a0f1a", border: "1px dashed #1e293b" }}
        >
          <div className="text-3xl opacity-20">📷</div>
          <p className="text-sm text-slate-600">Wide-angle room feed</p>
          <p className="text-xs text-slate-700">Awaiting LiveKit connection</p>
        </div>
      </div>
    </section>
  );
}
