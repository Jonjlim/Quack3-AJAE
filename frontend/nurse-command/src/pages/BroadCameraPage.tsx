import { useEffect, useState } from "react";
import { useBroadCameraPublisher } from "../hooks/useBroadCameraPublisher";
import { useFallDetection, type FallDetectionMode } from "../hooks/useFallDetection";

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
  "Use the rear camera and clean the lens before mounting.",
  "Place the device high in a corner, angled down at the monitoring zone.",
  "Keep the area bright and avoid backlighting from windows.",
  "Frame the full room — Gemini AI works best when full bodies are visible in the clip.",
];

function StatusIndicator({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-block h-3 w-3 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`}
      aria-hidden
    />
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border p-6 ${className}`}
      style={{
        background: "#ffffff",
        borderColor: "#e2e8f0",
        boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {children}
    </div>
  );
}

export default function BroadCameraPage() {
  const [roomNameInput, setRoomNameInput] = useState("");
  const [activeRoomName, setActiveRoomName] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString("en-GB"));
  const [detectionMode, setDetectionMode] = useState<FallDetectionMode>("snapshot");

  useEffect(() => {
    const fromUrl = readRoomFromUrl();
    const fromStore = readStoredRoomName();
    setRoomNameInput(fromUrl || fromStore);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString("en-GB")), 1000);
    return () => clearInterval(id);
  }, []);

  const { status, errorMessage, stream, connect } = useBroadCameraPublisher(activeRoomName);
  const isLive = status === "live";
  const isStarting = status === "starting";
  const wasReplaced = status === "replaced";
  const isSetup = activeRoomName === null;

  const { cvReady } = useFallDetection(stream, isLive, activeRoomName, detectionMode);

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
    <div className="flex min-h-screen flex-col" style={{ color: "var(--text)" }}>
      <header
        className="cc-header-stripe flex-shrink-0 px-5 py-3"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <p
          className="text-[11px] font-bold tracking-[0.12em] uppercase"
          style={{ color: "var(--accent)" }}
        >
          ER · Overwatch
        </p>
        <h1 className="text-base font-bold tracking-tight">Room Camera</h1>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Wide-angle feed for the nurse dashboard
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
        <Panel>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>
            Sign in with Google first. On a laptop, the front camera is used if no rear camera exists.
          </p>

          {isSetup ? (
            <div className="mt-5 flex flex-col gap-4 text-left">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Name this room or bay so nurses see it on the dashboard. Each name can have one live
                feed at a time.
              </p>
              <label className="block">
                <span
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Room name
                </span>
                <input
                  type="text"
                  value={roomNameInput}
                  onChange={(e) => setRoomNameInput(e.target.value)}
                  placeholder="e.g. Triage Bay A"
                  className="mt-1 w-full rounded-xl border px-4 py-3 text-base outline-none"
                  style={{
                    borderColor: "#e2e8f0",
                    background: "#ffffff",
                    color: "var(--text)",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") startRoomFeed();
                  }}
                />
              </label>
              <button
                type="button"
                onClick={startRoomFeed}
                disabled={roomNameInput.trim().length < 2}
                className="rounded-xl px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: "#2563eb" }}
              >
                Start camera for this room
              </button>
            </div>
          ) : (
            <div className="mt-5 flex flex-col items-center gap-4 text-center">
              <p className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
                {activeRoomName}
              </p>
              <StatusIndicator live={isLive} />

              {isLive && (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold" style={{ color: "#15803d" }}>
                      Live
                    </p>
                    {!cvReady && (
                      <span
                        className="animate-pulse rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "#f1f5f9", color: "var(--text-muted)" }}
                      >
                        AI Analysis Loading…
                      </span>
                    )}
                    {cvReady && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{ background: "rgba(124,58,237,0.12)", color: "#7c3aed" }}
                      >
                        AI Active
                      </span>
                    )}
                  </div>

                  {/* Detection mode toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
                      Detection
                    </span>
                    <div className="inline-flex overflow-hidden border border-[var(--border)]">
                      <button
                        type="button"
                        onClick={() => setDetectionMode("snapshot")}
                        className={`px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors ${detectionMode === "snapshot"
                            ? "bg-slate-800 text-white"
                            : "bg-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
                          }`}
                      >
                        Images
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetectionMode("video")}
                        className={`px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors ${detectionMode === "video"
                            ? "bg-slate-800 text-white"
                            : "bg-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
                          }`}
                      >
                        Video
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Publishing 720p room video for fall detection. Nurses see &quot;{activeRoomName}&quot;
                    on the dashboard wide-angle feed.
                  </p>
                  <button
                    type="button"
                    onClick={changeRoom}
                    className="text-sm underline-offset-2 hover:underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Use a different room name
                  </button>
                </>
              )}

              {isStarting && (
                <>
                  <p className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                    Starting camera…
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Opening the camera at 720p and connecting to LiveKit for {activeRoomName}.
                  </p>
                </>
              )}

              {wasReplaced && (
                <>
                  <p className="text-lg font-bold" style={{ color: "var(--amber)" }}>
                    Not recording
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    Another device is already streaming &quot;{activeRoomName}&quot;. Stop the other feed
                    or pick a different room name.
                  </p>
                  <button
                    type="button"
                    onClick={() => void connect()}
                    className="mt-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
                    style={{ background: "#2563eb" }}
                  >
                    Retry this room
                  </button>
                  <button
                    type="button"
                    onClick={changeRoom}
                    className="text-sm underline-offset-2 hover:underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Choose another room name
                  </button>
                </>
              )}

              {status === "error" && (
                <>
                  <p className="text-lg font-bold" style={{ color: "var(--critical)" }}>
                    Not recording
                  </p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {errorMessage ?? "Could not start the camera feed."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void connect()}
                    className="mt-2 rounded-xl px-6 py-3 text-sm font-semibold text-white"
                    style={{ background: "#2563eb" }}
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={changeRoom}
                    className="text-sm underline-offset-2 hover:underline"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Change room name
                  </button>
                </>
              )}
            </div>
          )}
        </Panel>

        <Panel>
          <h2
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Demo camera setup
          </h2>
          <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--text-2)" }}>
            {SETUP_TIPS.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: "var(--accent)" }}
                />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <a
          href="/"
          className="text-center text-sm transition-colors hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Back to Nurse Command Center
        </a>
      </main>

      <footer
        className="flex flex-shrink-0 items-center justify-between px-5 py-2"
        style={{
          background: "#ffffff",
          borderTop: "1px solid #e2e8f0",
          boxShadow: "0 -2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <span className="text-[10px] font-bold tracking-widest" style={{ color: "var(--accent)" }}>
          ER·OVERWATCH
        </span>
        <span className="text-[10px] font-bold" style={{ color: "var(--accent)" }}>
          {clock}
        </span>
      </footer>
    </div>
  );
}
