import { useEffect, useRef, useState } from "react";
import { useBroadCameraPublisher } from "../hooks/useBroadCameraPublisher";
import { useFallDetection } from "../hooks/useFallDetection";

const ROOM_NAME_KEY = "er-overwatch-room-camera-name";

function readRoomFromUrl(): string {
  if (typeof window === "undefined") return "";
  const param = new URLSearchParams(window.location.search).get("room");
  return param?.trim() ?? "";
}

function readStoredRoomName(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ROOM_NAME_KEY)?.trim() ?? "";
}

const SETUP_TIPS = [
  "Use the rear camera and clean the lens before judging.",
  "Place the device high in a corner, angled down at the demo fall zone.",
  "Keep the fall zone bright and avoid backlighting from windows.",
  "Frame full bodies, not just faces — MediaPipe needs shoulders and hips visible.",
];

function StatusIndicator({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full ${live ? "animate-pulse bg-emerald-400" : "bg-slate-500"}`}
      aria-hidden
    />
  );
}

export default function BroadCameraPage() {
  const [roomNameInput, setRoomNameInput] = useState("");
  const [activeRoomName, setActiveRoomName] = useState<string | null>(null);

  useEffect(() => {
    const fromUrl = readRoomFromUrl();
    const fromStore = readStoredRoomName();
    setRoomNameInput(fromUrl || fromStore);
  }, []);

  const { status, errorMessage, stream, connect } = useBroadCameraPublisher(activeRoomName);
  const isLive = status === "live";
  const isStarting = status === "starting";
  const wasReplaced = status === "replaced";
  const isSetup = activeRoomName === null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { cvReady } = useFallDetection(stream, isLive, canvasRef, activeRoomName);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  function startRoomFeed() {
    const label = roomNameInput.trim();
    if (label.length < 2) return;
    sessionStorage.setItem(ROOM_NAME_KEY, label);
    setActiveRoomName(label);
  }

  function changeRoom() {
    setActiveRoomName(null);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-white">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center shadow-xl">
        <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
          ER-OVERWATCH
        </p>
        <h1 className="mt-2 text-2xl font-bold">Room Camera</h1>
        <p className="mt-2 text-sm text-slate-400">
          Sign in with Google first. On a laptop, the front camera is used if no rear camera exists.
        </p>

        {isSetup ? (
          <div className="mt-6 flex flex-col items-stretch gap-4 text-left">
            <p className="text-sm text-slate-400">
              Name this room or bay so nurses see it on the dashboard. Each name can have one
              live feed at a time.
            </p>
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Room name
              </span>
              <input
                type="text"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                placeholder="e.g. Triage Bay A"
                className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-lg text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") startRoomFeed();
                }}
              />
            </label>
            <button
              type="button"
              onClick={startRoomFeed}
              disabled={roomNameInput.trim().length < 2}
              className="rounded-xl bg-emerald-600 px-6 py-4 text-lg font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start camera for this room
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-sm font-medium text-blue-300">{activeRoomName}</p>
            <StatusIndicator live={isLive} />

            {isLive && (
              <>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold text-emerald-300">Live</p>
                  {!cvReady && (
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
                  Publishing 720p room video. Fall detection runs on this device. Nurses see
                  &quot;{activeRoomName}&quot; on the wide-angle feed.
                </p>
                <div className="relative w-full overflow-hidden rounded-xl bg-black">
                  <div className="camera-feed-correct relative w-full">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full"
                    />
                    {/* Canvas must be inside camera-feed-correct so its containing block
                        is the same div as the video — prevents stacking-context issues.
                        The CSS rule only targets > video, so this canvas is NOT CSS-flipped. */}
                    <canvas
                      ref={canvasRef}
                      className="pointer-events-none absolute inset-0 z-10 h-full w-full"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={changeRoom}
                  className="text-sm text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
                >
                  Use a different room name
                </button>
              </>
            )}

            {isStarting && (
              <>
                <p className="text-xl font-semibold text-blue-300">Starting camera…</p>
                <p className="text-sm text-slate-400">
                  Opening the camera at 720p and connecting to LiveKit for {activeRoomName}.
                </p>
              </>
            )}

            {wasReplaced && (
              <>
                <p className="text-xl font-semibold text-amber-300">Not recording</p>
                <p className="text-sm text-slate-400">
                  Another device is already streaming &quot;{activeRoomName}&quot;. Stop the other
                  feed or pick a different room name.
                </p>
                <button
                  type="button"
                  onClick={() => void connect()}
                  className="mt-4 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
                >
                  Retry this room
                </button>
                <button
                  type="button"
                  onClick={changeRoom}
                  className="text-sm text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
                >
                  Choose another room name
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
                <button
                  type="button"
                  onClick={changeRoom}
                  className="text-sm text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
                >
                  Change room name
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <section className="mt-5 w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-left">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Demo camera setup
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-400">
          {SETUP_TIPS.map((tip) => (
            <li key={tip} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      <a
        href="/"
        className="mt-8 text-sm text-slate-500 transition-colors hover:text-slate-300"
      >
        ← Back to Nurse Command Center
      </a>
    </div>
  );
}
