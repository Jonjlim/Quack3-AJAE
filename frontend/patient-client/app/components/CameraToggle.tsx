"use client";

import { assertCameraAvailable, cameraUnavailableMessage } from "@/lib/camera-utils";
import { getApiBase } from "@/lib/api-base";
import type { BiometricReading, LiveKitTokenResponse } from "@shared/types/telemetry";
import { useRppgSampler } from "@/lib/useRppgSampler";
import { setCameraEnabled } from "@/lib/ws-client";
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
  const enabledRef = useRef(false);
  const onCameraChangeRef = useRef(onCameraChange);
  onCameraChangeRef.current = onCameraChange;
  enabledRef.current = enabled;

  const identity = useMemo(() => patientId, [patientId]);
  const roomName = useMemo(() => room, [room]);

  function formatHrStatus(reading: BiometricReading): string {
    const hr = Math.round(reading.heart_rate_bpm ?? 0);
    if (reading.heart_rate_bpm_low != null && reading.heart_rate_bpm_high != null) {
      return `Streaming · HR ${hr} bpm (${Math.round(reading.heart_rate_bpm_low)}–${Math.round(reading.heart_rate_bpm_high)})`;
    }
    return `Streaming · HR ${hr} bpm`;
  }

  useRppgSampler({
    patientId,
    track: samplingTrack,
    enabled,
    onSample: ({ reading, analysis }) => {
      if (reading?.heart_rate_bpm != null && analysis.measurement_status !== "unreliable") {
        setStatus(formatHrStatus(reading));
        return;
      }
      if (analysis.measurement_status === "unreliable" || analysis.error) {
        setStatus(`Streaming · ${analysis.error ?? "hold still, face the camera"}`);
        return;
      }
      if (analysis.heart_rate_bpm != null && analysis.heart_rate_bpm_low != null && analysis.heart_rate_bpm_high != null) {
        setStatus(
          `Streaming · HR ${Math.round(analysis.heart_rate_bpm)} bpm (${Math.round(analysis.heart_rate_bpm_low)}–${Math.round(analysis.heart_rate_bpm_high)}) · estimating`,
        );
        return;
      }
      setStatus("Streaming · hold still · measuring vitals (~8s)");
    },
    onError: (message) => {
      if (message.includes("503") || message.toLowerCase().includes("dependencies")) {
        setStatus("Streaming · vitals backend unavailable (install backend/rppg deps)");
        return;
      }
      if (message.includes("404")) {
        setStatus("Streaming · patient not found — re-submit intake");
        return;
      }
      setStatus("Streaming · keep face visible for vitals");
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
    if (enabledRef.current) {
      try {
        await setCameraEnabled(patientId, false);
      } catch {
        // best-effort on stop
      }
    }
    enabledRef.current = false;
    setEnabled(false);
    setSamplingTrack(null);
    setStatus("Camera off");
    onCameraChangeRef.current?.(false);
  }, [patientId]);

  // Tear down only on unmount — not when parent re-renders (queue WS updates).
  useEffect(() => {
    return () => {
      void stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCamera = useCallback(async () => {
    if (enabled) {
      await stopStream();
      return;
    }

    setStatus("Connecting…");
    try {
      assertCameraAvailable();

      const response = await fetch(`${getApiBase()}/api/v1/livekit/token`, {
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
        frameRate: 30,
      });
      videoTrackRef.current = videoTrack;
      await lkRoom.localParticipant.publishTrack(videoTrack);

      await setCameraEnabled(patientId, true);
      enabledRef.current = true;
      onCameraChangeRef.current?.(true);
      setSamplingTrack(videoTrack.mediaStreamTrack);
      setEnabled(true);
      setStatus("Hold still · measuring vitals (~8s)");

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoTrack.attach(videoRef.current);
        }
      });
    } catch (err) {
      await stopStream();
      onCameraChangeRef.current?.(false);
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.toLowerCase().includes("permission") || message.includes("NotAllowed")) {
        setStatus("Camera permission denied — allow access in browser settings");
      } else if (message.includes("getUserMedia") || message.includes("secure")) {
        setStatus(cameraUnavailableMessage());
      } else if (message.includes("Token request failed")) {
        setStatus("Could not reach triage server — check backend is running");
      } else {
        setStatus(`Connection failed — ${message}`);
      }
    }
  }, [enabled, identity, patientId, roomName, stopStream]);

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
