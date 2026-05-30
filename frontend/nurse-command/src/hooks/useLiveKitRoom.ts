import { useCallback, useMemo, useState } from "react";

export function useLiveKitRoom(room = "er-waiting-room", identity = "nurse-01") {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomName = useMemo(() => room, [room]);
  const participantId = useMemo(() => identity, [identity]);

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
      setConnected(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnected(false);
    }
  }, [roomName, participantId]);

  const disconnect = useCallback(() => {
    setConnected(false);
  }, []);

  return { connected, error, connect, disconnect, roomName };
}
