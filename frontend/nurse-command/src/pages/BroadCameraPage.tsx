import { useEffect, useRef } from "react";
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
  const isStarting = status === "starting";
  const wasReplaced = status === "replaced";

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { cvReady } = useFallDetection(stream, isLive, canvasRef);

  // Mirror stream into the visible video element
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
          ER-OVERWATCH
        </p>
        <h1 className="mt-2 text-2xl font-bold">Room Camera</h1>

        <div className="mt-6 flex flex-col items-center gap-4">
          <StatusIndicator live={isLive} />

          {isLive && (
            <>
              <div className="flex items-center gap-2">
                <p className="text-xl font-semibold text-emerald-300">Live</p>
                {isLive && !cvReady && (
                  <span className="animate-pulse rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                    CV Loading…
                  </span>
                )}
                {cvReady && (
                  <span className="rounded-full bg-violet-900 px-2 py-0.5 text-xs font-medium text-violet-300">
                    CV Active
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">
                Fall detection runs on this device. Alerts appear on the nurse dashboard.
              </p>

              {/* Live preview with skeleton overlay */}
              <div className="relative w-full overflow-hidden rounded-xl bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full"
                />
                <canvas
                  ref={canvasRef}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
              </div>
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
                Another device took over this camera feed. Only one room camera can be live at a time.
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

