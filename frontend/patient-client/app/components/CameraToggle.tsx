"use client";

import { useCallback, useMemo, useState } from "react";

interface CameraToggleProps {
  patientId: string;
  room?: string;
}

export function CameraToggle({ patientId, room = "er-waiting-room" }: CameraToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string>("Camera off");

  const identity = useMemo(() => patientId, [patientId]);
  const roomName = useMemo(() => room, [room]);

  const toggleCamera = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      setStatus("Camera off");
      return;
    }

    setStatus("Connecting…");
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const response = await fetch(`${apiBase}/api/v1/livekit/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomName, identity, role: "patient" }),
      });
      if (!response.ok) throw new Error("Token request failed");
      setEnabled(true);
      setStatus("Streaming to triage nurse");
    } catch {
      setStatus("Connection failed — retry or use mock mode");
      setEnabled(false);
    }
  }, [enabled, identity, roomName]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Remote Evaluation</h3>
      <p className="mt-1 text-sm text-slate-500">
        Share your camera so a nurse can assess you while you wait.
      </p>
      <p className="mt-3 text-sm font-medium text-slate-700">{status}</p>
      <button
        type="button"
        onClick={toggleCamera}
        className={`mt-4 w-full rounded-xl px-6 py-5 text-lg font-semibold ${
          enabled
            ? "bg-red-600 text-white active:bg-red-700"
            : "bg-emerald-600 text-white active:bg-emerald-700"
        }`}
      >
        {enabled ? "Stop Camera" : "Start Camera"}
      </button>
    </div>
  );
}
