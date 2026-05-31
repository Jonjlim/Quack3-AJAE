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
import {
  ER_WAITING_ROOM,
  roomCameraIdentity,
} from "../lib/livekit-constants";

export type BroadCameraStatus = "starting" | "live" | "replaced" | "error" | "idle";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function useBroadCameraPublisher(roomLabel: string | null) {
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
      track.detach();
      videoTrackRef.current = null;
    }
    setStream(null);
    const lkRoom = roomRef.current;
    if (lkRoom) {
      await lkRoom.disconnect();
      roomRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    const label = roomLabel?.trim();
    if (!label) return;

    intentionalDisconnectRef.current = false;
    setStatus("starting");
    setErrorMessage(null);

    try {
      const identity = roomCameraIdentity(label);
      const response = await authFetch(`${API_BASE}/api/v1/livekit/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: ER_WAITING_ROOM,
          identity,
          role: "broad_camera",
          display_name: label,
        }),
      });
      if (!response.ok) throw new Error("Could not obtain LiveKit token");

      const tokenData = (await response.json()) as LiveKitTokenResponse;
      const lkRoom = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = lkRoom;

      lkRoom.on(RoomEvent.Disconnected, (reason) => {
        if (intentionalDisconnectRef.current) return;
        if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
          setStatus("replaced");
          setErrorMessage(null);
        } else {
          setStatus("error");
          setErrorMessage("Connection lost — check network and LiveKit");
        }
      });

      await lkRoom.connect(tokenData.url, tokenData.token);

      const videoTrack = await createLocalVideoTrack({
        facingMode: "environment",
        resolution: { width: 1280, height: 720 },
      });
      videoTrackRef.current = videoTrack;
      await lkRoom.localParticipant.publishTrack(videoTrack);
      setStream(new MediaStream([videoTrack.mediaStreamTrack]));

      setStatus("live");
    } catch (err) {
      await cleanup();
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to start camera feed");
    }
  }, [cleanup, roomLabel]);

  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    await cleanup();
    setStatus("idle");
    setErrorMessage(null);
  }, [cleanup]);

  useEffect(() => {
    const label = roomLabel?.trim();
    if (!label) {
      void cleanup();
      setStatus("idle");
      return;
    }

    void connect();
    return () => {
      intentionalDisconnectRef.current = true;
      void cleanup();
    };
  }, [roomLabel, connect, cleanup]);

  return { status, errorMessage, stream, connect, disconnect };
}
