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
  "Frame the full room — AI works best when full bodies are visible.",
];

function StatusIndicator({ live }: { live: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 ${live ? "signal-blink bg-[var(--status-stable)]" : "bg-[var(--text-dim)]"}`}
      aria-hidden
    />
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`panel p-4 ${className}`}>
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
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--text)]">
      <header className="cc-header-stripe flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        <p className="telemetry-label text-[var(--text-dim)]">ER · Overwatch</p>
        <h1 className="text-sm font-semibold tracking-tight">Room Camera</h1>
        <p className="text-[10px] text-[var(--text-muted)]">
          Wide-angle feed for the nurse dashboard
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2 px-3 py-4">
        <Panel>
          <p className="text-[11px] text-[var(--text-2)]">
            Sign in with Google first. On a laptop, the front camera is used if no rear camera exists.
          </p>

          {isSetup ? (
            <div className="mt-4 flex flex-col gap-3 text-left">
              <p className="text-[11px] text-[var(--text-muted)]">
                Name this room or bay so nurses see it on the dashboard. Each name can have one live
                feed at a time.
              </p>
              <label className="block">
                <span className="telemetry-label">Room name</span>
                <input
                  type="text"
                  value={roomNameInput}
                  onChange={(e) => setRoomNameInput(e.target.value)}
                  placeholder="e.g. Triage Bay A"
                  className="mt-1 w-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--text-muted)]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") startRoomFeed();
                  }}
                />
              </label>
              <button
                type="button"
                onClick={startRoomFeed}
                disabled={roomNameInput.trim().length < 2}
                className="border border-slate-800 bg-slate-800 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start camera for this room
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-3 text-center">
              <p className="telemetry-value text-sm font-medium text-[var(--text)]">
                {activeRoomName}
              </p>
              <StatusIndicator live={isLive} />

              {isLive && (
                <>
                  <div className="flex items-center gap-2">
                    <p className="telemetry-value text-sm font-medium text-[var(--status-stable)]">
                      LIVE
                    </p>
                    {!cvReady && (
                      <span className="border border-[var(--border)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest text-[var(--text-dim)]">
                        AI Loading
                      </span>
                    )}
                    {cvReady && (
                      <span className="border border-[var(--status-stable)] px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest text-[var(--status-stable)]">
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
                        className={`px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors ${
                          detectionMode === "snapshot"
                            ? "bg-slate-800 text-white"
                            : "bg-transparent text-[var(--text-dim)] hover:text-[var(--text)]"
                        }`}
                      >
                        Images
                      </button>
                      <button
                        type="button"
                        onClick={() => setDetectionMode("video")}
                        className={`px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-colors ${
                          detectionMode === "video"
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
                    className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Use a different room name
                  </button>
                </>
              )}

              {isStarting && (
                <>
                  <p className="telemetry-value text-sm font-medium text-[var(--text)]">
                    Starting camera…
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Opening the camera at 720p and connecting to LiveKit for {activeRoomName}.
                  </p>
                </>
              )}

              {wasReplaced && (
                <>
                  <p className="text-sm font-semibold text-[var(--status-alert)]">
                    Not recording
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Another device is already streaming &quot;{activeRoomName}&quot;. Stop the other feed
                    or pick a different room name.
                  </p>
                  <button
                    type="button"
                    onClick={() => void connect()}
                    className="mt-1 border border-slate-800 bg-slate-800 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white"
                  >
                    Retry this room
                  </button>
                  <button
                    type="button"
                    onClick={changeRoom}
                    className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Choose another room name
                  </button>
                </>
              )}

              {status === "error" && (
                <>
                  <p className="text-sm font-semibold text-[var(--status-critical)]">
                    Not recording
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {errorMessage ?? "Could not start the camera feed."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void connect()}
                    className="mt-1 border border-slate-800 bg-slate-800 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={changeRoom}
                    className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    Change room name
                  </button>
                </>
              )}
            </div>
          )}
        </Panel>

        <Panel>
          <h2 className="telemetry-label">Demo camera setup</h2>
          <ul className="mt-2 space-y-1.5 text-[11px] text-[var(--text-2)]">
            {SETUP_TIPS.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 bg-[var(--text-dim)]" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <a
          href="/"
          className="text-center text-[10px] uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          ← Back to Nurse Command Center
        </a>
      </main>

      <footer className="flex flex-shrink-0 items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-3 py-1">
        <span className="telemetry-label text-[var(--text-dim)]">ER·OVERWATCH</span>
        <span className="telemetry-value text-[10px] font-medium">{clock}</span>
      </footer>
    </div>
  );
}
