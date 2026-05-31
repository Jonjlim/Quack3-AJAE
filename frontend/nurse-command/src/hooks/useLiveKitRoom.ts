import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteTrackPublication } from "livekit-client";

export interface RemoteVideoTrack {
  identity: string;
  mediaStreamTrack: MediaStreamTrack;
}

export function useLiveKitRoom(
  room = "er-waiting-room",
  identity = "nurse-01",
  /** When set, only these LiveKit participant identities are shown (ignores stale publishers). */
  allowedIdentities?: ReadonlySet<string>,
) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteVideos, setRemoteVideos] = useState<RemoteVideoTrack[]>([]);
  const roomRef = useRef<Room | null>(null);
  const allowedIdentitiesRef = useRef(allowedIdentities);
  allowedIdentitiesRef.current = allowedIdentities;

  const roomName = useMemo(() => room, [room]);
  const participantId = useMemo(() => identity, [identity]);

  useEffect(() => {
    if (!allowedIdentities) return;
    setRemoteVideos((prev) => prev.filter((v) => allowedIdentities.has(v.identity)));
  }, [allowedIdentities]);

  const disconnect = useCallback(async () => {
    const lkRoom = roomRef.current;
    if (lkRoom) {
      await lkRoom.disconnect();
      roomRef.current = null;
    }
    setRemoteVideos([]);
    setConnected(false);
  }, []);

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  const connect = useCallback(async () => {
    setError(null);
    try {
      const apiBase = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
      const response = await fetch(`${apiBase}/api/v1/livekit/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomName, identity: participantId, role: "nurse" }),
      });
      if (!response.ok) throw new Error("Token request failed");

      const tokenData = (await response.json()) as {
        token: string;
        url: string;
      };

      const lkRoom = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = lkRoom;

      const addVideo = (participantIdentity: string, publication: RemoteTrackPublication) => {
        const allowed = allowedIdentitiesRef.current;
        if (allowed && !allowed.has(participantIdentity)) {
          if (publication.kind === Track.Kind.Video) {
            publication.setSubscribed(false);
          }
          return;
        }
        if (publication.kind !== Track.Kind.Video || !publication.track) return;
        const mediaStreamTrack = publication.track.mediaStreamTrack;
        setRemoteVideos((prev) => {
          const filtered = prev.filter((v) => v.identity !== participantIdentity);
          return [...filtered, { identity: participantIdentity, mediaStreamTrack }];
        });
      };

      const removeVideo = (participantIdentity: string) => {
        setRemoteVideos((prev) => prev.filter((v) => v.identity !== participantIdentity));
      };

      lkRoom.on(RoomEvent.TrackSubscribed, (_track, publication, participant) => {
        addVideo(participant.identity, publication);
      });

      lkRoom.on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => {
        if (publication.kind === Track.Kind.Video) {
          removeVideo(participant.identity);
        }
      });

      lkRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        removeVideo(participant.identity);
      });

      await lkRoom.connect(tokenData.url, tokenData.token);

      for (const participant of lkRoom.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          addVideo(participant.identity, publication);
        }
      }

      setConnected(true);
    } catch (err) {
      await disconnect();
      setError(err instanceof Error ? err.message : "Connection failed");
    }
  }, [disconnect, participantId, roomName]);

  const getVideoForIdentity = useCallback(
    (targetIdentity: string) =>
      remoteVideos.find((v) => v.identity === targetIdentity) ?? null,
    [remoteVideos],
  );

  return {
    connected,
    error,
    connect,
    disconnect,
    roomName,
    remoteVideos,
    getVideoForIdentity,
  };
}
