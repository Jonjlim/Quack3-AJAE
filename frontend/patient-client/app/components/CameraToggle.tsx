"use client";

import type { LiveKitTokenResponse } from "@shared/types/telemetry";
import { useRppgSampler } from "@/lib/useRppgSampler";
import {
  createLocalVideoTrack,
  Room,
  type LocalVideoTrack,
} from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface CameraToggleProps {
  patientId: string;
  room?: string;
  onCameraChange?: (enabled: boolean) => void;
}

export function CameraToggle({ patientId, room = "er-waiting-room", onCameraChange }: CameraToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string>("Camera off");
  const [samplingTrack, setSamplingTrack] = useState<MediaStreamTrack | null>(null);
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const identity = useMemo(() => patientId, [patientId]);
  const roomName = useMemo(() => room, [room]);

  useRppgSampler({
    patientId,
    track: samplingTrack,
    enabled,
    onSample: ({ reading, analysis }) => {
      if (reading?.heart_rate_bpm != null) {
        setStatus(`Streaming · HR ${Math.round(reading.heart_rate_bpm)} bpm`);
        return;
      }
      if (analysis.error) {
        setStatus("Streaming · keep face visible for vitals");
        return;
      }
      setStatus("Streaming to triage nurse");
    },
  });

  const stopStream = useCallback(async () => {
    const track = videoTrackRef.current;
    if (track) {
      track.stop();
      track.detach();
      videoTrackRef.current = null;
    }
    const lkRoom = roomRef.current;
    if (lkRoom) {
      await lkRoom.disconnect();
      roomRef.current = null;
    }
    setEnabled(false);
    setSamplingTrack(null);
    setStatus("Camera off");
    onCameraChange?.(false);
  }, [onCameraChange]);

  useEffect(() => {
    return () => {
      void stopStream();
    };
  }, [stopStream]);

  const toggleCamera = useCallback(async () => {
    if (enabled) {
      await stopStream();
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

      const tokenData = (await response.json()) as LiveKitTokenResponse;
      const lkRoom = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = lkRoom;

      await lkRoom.connect(tokenData.url, tokenData.token);

      const videoTrack = await createLocalVideoTrack({
        facingMode: "user",
        resolution: { width: 640, height: 480 },
      });
      videoTrackRef.current = videoTrack;
      await lkRoom.localParticipant.publishTrack(videoTrack);

      onCameraChange?.(true);
      setSamplingTrack(videoTrack.mediaStreamTrack);
      setEnabled(true);
      setStatus("Streaming to triage nurse · measuring vitals");

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoTrack.attach(videoRef.current);
        }
      });
    } catch {
      await stopStream();
      onCameraChange?.(false);
      setStatus(
        "Connection failed — check LiveKit Cloud credentials and retry",
      );
    }
  }, [enabled, identity, onCameraChange, roomName, stopStream]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Remote Evaluation</h3>
      <p className="mt-1 text-sm text-slate-500">
        Share your camera so a nurse can assess you while you wait. Heart rate is
        estimated periodically from your video while the camera is on.
      </p>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`mt-4 aspect-video w-full rounded-xl bg-slate-900 object-cover ${
          enabled ? "block" : "hidden"
        }`}
      />
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
