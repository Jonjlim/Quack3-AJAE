import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrackPublication } from "livekit-client";
import { authFetch } from "../lib/auth-fetch";
import { getApiBase, isMockMode } from "../lib/api-base";
import { isRoomCameraIdentity } from "../lib/livekit-constants";

const USE_MOCK = isMockMode();

export interface RemoteVideoTrack {
  identity: string;
  mediaStreamTrack: MediaStreamTrack;
  displayName: string;
}

function isVideoAllowed(
  participantIdentity: string,
  allowedPatientIds?: ReadonlySet<string>,
): boolean {
  if (!allowedPatientIds) return true;
  if (allowedPatientIds.has(participantIdentity)) return true;
  if (isRoomCameraIdentity(participantIdentity)) return true;
  return false;
}

export function useLiveKitRoom(
  room = "er-waiting-room",
  identity = "nurse-01",
  /** Patient IDs to show; all room-camera identities (room-cam:*) are always allowed. */
  allowedPatientIds?: ReadonlySet<string>,
) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideoTrack[]>([]);
  const [connectEpoch, setConnectEpoch] = useState(0);
  const roomRef = useRef<Room | null>(null);
  const allowedPatientIdsRef = useRef(allowedPatientIds);
  allowedPatientIdsRef.current = allowedPatientIds;

  const roomName = useMemo(() => room, [room]);
  const participantId = useMemo(() => identity, [identity]);

  useEffect(() => {
    if (!allowedPatientIds) return;
    setRemoteVideos((prev) =>
      prev.filter((v) => isVideoAllowed(v.identity, allowedPatientIds)),
    );
  }, [allowedPatientIds]);

  const disconnect = useCallback(async () => {
    const lkRoom = roomRef.current;
    roomRef.current = null;
    if (lkRoom) {
      await lkRoom.disconnect();
    }
    setRemoteVideos([]);
    setConnected(false);
    setConnecting(false);
  }, []);

  useEffect(() => {
    if (USE_MOCK) {
      setError("Live video is disabled in mock mode (set VITE_USE_MOCK=false)");
      return;
    }

    let cancelled = false;
    let lkRoom: Room | null = null;

    const addVideo = (
      participantIdentity: string,
      participantName: string,
      publication: RemoteTrackPublication,
    ) => {
      const allowed = allowedPatientIdsRef.current;
      if (!isVideoAllowed(participantIdentity, allowed)) {
        if (publication.kind === Track.Kind.Video) {
          publication.setSubscribed(false);
        }
        return;
      }
      if (publication.kind !== Track.Kind.Video || !publication.track) return;
      const mediaStreamTrack = publication.track.mediaStreamTrack;
      const displayName = participantName.trim() || participantIdentity;
      setRemoteVideos((prev) => {
        const filtered = prev.filter((v) => v.identity !== participantIdentity);
        return [...filtered, { identity: participantIdentity, mediaStreamTrack, displayName }];
      });
    };

    const removeVideo = (participantIdentity: string) => {
      setRemoteVideos((prev) => prev.filter((v) => v.identity !== participantIdentity));
    };

    void (async () => {
      setConnecting(true);
      setError(null);
      setConnected(false);
      setRemoteVideos([]);

      try {
        const apiBase = getApiBase();
        const response = await authFetch(`${apiBase}/api/v1/livekit/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room: roomName, identity: participantId, role: "nurse" }),
        });
        if (cancelled) return;
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(detail || "Token request failed");
        }

        const tokenData = (await response.json()) as {
          token: string;
          url: string;
        };
        if (cancelled) return;

        lkRoom = new Room({ adaptiveStream: true, dynacast: true });

        lkRoom.on(RoomEvent.TrackSubscribed, (_track, publication, participant) => {
          if (cancelled) return;
          addVideo(participant.identity, participant.name ?? "", publication);
        });

        lkRoom.on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => {
          if (cancelled) return;
          if (publication.kind === Track.Kind.Video) {
            removeVideo(participant.identity);
          }
        });

        lkRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (cancelled) return;
          removeVideo(participant.identity);
        });

        await lkRoom.connect(tokenData.url, tokenData.token);
        if (cancelled) return;

        roomRef.current = lkRoom;

        for (const participant of lkRoom.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            addVideo(participant.identity, participant.name ?? "", publication);
          }
        }

        setConnected(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Connection failed");
        }
      } finally {
        if (cancelled && lkRoom) {
          await lkRoom.disconnect();
          lkRoom = null;
        }
        if (!cancelled) {
          setConnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      roomRef.current = null;
      if (lkRoom) {
        void lkRoom.disconnect();
      }
      setConnecting(false);
      setConnected(false);
      setRemoteVideos([]);
    };
  }, [roomName, participantId, connectEpoch]);

  /** Re-run the auto-connect lifecycle (e.g. after an error). */
  const connect = useCallback(() => {
    setConnectEpoch((n) => n + 1);
  }, []);

  const getVideoForIdentity = useCallback(
    (targetIdentity: string) =>
      remoteVideos.find((v) => v.identity === targetIdentity) ?? null,
    [remoteVideos],
  );

  return {
    connected,
    connecting,
    error,
    connect,
    disconnect,
    roomName,
    remoteVideos,
    getVideoForIdentity,
  };
}
