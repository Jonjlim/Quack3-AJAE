import { useBroadCameraPublisher } from "../hooks/useBroadCameraPublisher";
import { useFallDetection } from "../hooks/useFallDetection";

function StatusIndicator({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-slate-500"}`}
      aria-hidden
    />
  );
}

export default function BroadCameraPage() {
  const { status, errorMessage, stream, connect } = useBroadCameraPublisher();
  const isLive = status === "live";

  useFallDetection(stream, isLive);
  const isStarting = status === "starting";
  const wasReplaced = status === "replaced";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
          ER-OVERWATCH
        </p>
        <h1 className="mt-2 text-2xl font-bold">Room Camera</h1>

        <div className="mt-10 flex flex-col items-center gap-4">
          <StatusIndicator live={isLive} />

          {isLive && (
            <>
              <p className="text-xl font-semibold text-emerald-300">Recording &amp; uploading</p>
              <p className="text-sm text-slate-400">
                Live feed is active. Fall detection runs on this device; nurses see alerts on the
                command dashboard.
              </p>
            </>
          )}

          {isStarting && (
            <>
              <p className="text-xl font-semibold text-blue-300">Starting camera…</p>
              <p className="text-sm text-slate-400">Connecting to LiveKit and opening the lens.</p>
            </>
          )}

          {wasReplaced && (
            <>
              <p className="text-xl font-semibold text-amber-300">Not recording</p>
              <p className="text-sm text-slate-400">
                Another device took over this camera feed. Only one room camera can be live at a
                time.
              </p>
              <button
                type="button"
                onClick={() => void connect()}
                className="mt-4 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Take over feed
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <p className="text-xl font-semibold text-red-300">Not recording</p>
              <p className="text-sm text-slate-400">
                {errorMessage ?? "Could not start the camera feed."}
              </p>
              <button
                type="button"
                onClick={() => void connect()}
                className="mt-4 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </div>

      <a
        href="/"
        className="mt-8 text-sm text-slate-500 transition-colors hover:text-slate-300"
      >
        ← Back to Nurse Command Center
      </a>
    </div>
  );
}
