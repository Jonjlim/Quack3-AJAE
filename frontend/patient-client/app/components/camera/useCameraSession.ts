"use client";

import { assertCameraAvailable, cameraUnavailableMessage } from "@/lib/camera-utils";
import { authFetch } from "@/lib/auth-fetch";
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

export interface UseCameraSessionOptions {
  patientId: string;
  room?: string;
  onCameraChange?: (enabled: boolean) => void;
}

export function useCameraSession({
  patientId,
  room = "er-waiting-room",
  onCameraChange,
}: UseCameraSessionOptions) {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string>("Camera off");
  const [connecting, setConnecting] = useState(false);
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
      if (
        analysis.heart_rate_bpm != null &&
        analysis.heart_rate_bpm_low != null &&
        analysis.heart_rate_bpm_high != null
      ) {
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
    setConnecting(false);
    setSamplingTrack(null);
    setStatus("Camera off");
    onCameraChangeRef.current?.(false);
  }, [patientId]);

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

    setConnecting(true);
    setStatus("Connecting…");
    try {
      assertCameraAvailable();

      const response = await authFetch(`${getApiBase()}/api/v1/livekit/token`, {
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
      setConnecting(false);
      setStatus("Hold still · measuring vitals (~8s)");

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoTrack.attach(videoRef.current);
        }
      });
    } catch (err) {
      await stopStream();
      onCameraChangeRef.current?.(false);
      setConnecting(false);
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

  return {
    enabled,
    connecting,
    status,
    videoRef,
    toggleCamera,
    stopStream,
  };
}
