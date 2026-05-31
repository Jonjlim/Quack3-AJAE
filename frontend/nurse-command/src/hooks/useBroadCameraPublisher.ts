import type { LiveKitTokenResponse } from "@shared/types/telemetry";
import {
  createLocalVideoTrack,
  DisconnectReason,
  Room,
  RoomEvent,
  type LocalVideoTrack,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../lib/auth-fetch";
import { BROAD_CAMERA_IDENTITY, ER_WAITING_ROOM } from "../lib/livekit-constants";

export type BroadCameraStatus = "starting" | "live" | "replaced" | "error" | "idle";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const ROOM_CAMERA_RESOLUTION = { width: 1280, height: 720 } as const;
const ROOM_CAMERA_FRAME_RATE = 30;

async function createRoomCameraTrack(): Promise<LocalVideoTrack> {
  const base = {
    resolution: ROOM_CAMERA_RESOLUTION,
    frameRate: ROOM_CAMERA_FRAME_RATE,
  };
  const attempts: Array<{ facingMode?: "environment" | "user" }> = [
    { facingMode: "environment" },
    { facingMode: "user" },
    {},
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await createLocalVideoTrack({ ...base, ...attempt });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Could not open camera");
}

function formatCameraError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Failed to start camera feed";
  if (message.toLowerCase().includes("permission") || message.includes("NotAllowed")) {
    return "Camera permission denied — allow camera access in browser settings";
  }
  if (message.includes("NotFound") || message.includes("DevicesNotFound")) {
    return "No camera found — use a phone/tablet with a rear camera for the room feed";
  }
  if (message.includes("Could not obtain LiveKit token")) {
    return "Could not reach triage server — sign in and check backend is running";
  }
  return message;
}

export function useBroadCameraPublisher() {
  const [status, setStatus] = useState<BroadCameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const intentionalDisconnectRef = useRef(false);

  const cleanup = useCallback(async () => {
    const track = videoTrackRef.current;
    if (track) {
      track.stop();
      videoTrackRef.current = null;
    }
    setStream(null);
    const room = roomRef.current;
    if (room) {
      await room.disconnect();
      roomRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    intentionalDisconnectRef.current = false;
    setStatus("starting");
    setErrorMessage(null);

    try {
      const response = await authFetch(`${API_BASE}/api/v1/livekit/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: ER_WAITING_ROOM,
          identity: BROAD_CAMERA_IDENTITY,
          role: "broad_camera",
        }),
      });
      if (!response.ok) throw new Error("Could not obtain LiveKit token");

      const tokenData = (await response.json()) as LiveKitTokenResponse;
      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.Disconnected, (reason) => {
        if (intentionalDisconnectRef.current) return;
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
          setStatus("replaced");
          setErrorMessage(null);
        } else {
          setStatus("error");
          setErrorMessage("Connection lost — check network and LiveKit");
        }
      });

      await room.connect(tokenData.url, tokenData.token);

      const videoTrack = await createRoomCameraTrack();
      videoTrackRef.current = videoTrack;
      await room.localParticipant.publishTrack(videoTrack);
      setStream(new MediaStream([videoTrack.mediaStreamTrack]));

      setStatus("live");
    } catch (err) {
      await cleanup();
      setStatus("error");
      setErrorMessage(formatCameraError(err));
    }
  }, [cleanup]);

  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    await cleanup();
    setStatus("idle");
    setErrorMessage(null);
  }, [cleanup]);

  useEffect(() => {
    void connect();
    return () => {
      intentionalDisconnectRef.current = true;
      void cleanup();
    };
  }, [connect, cleanup]);

  return { status, errorMessage, stream, connect, disconnect };
}
