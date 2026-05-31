import { useCallback, useRef, useState } from "react";

export function useLocalCamera() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    // Don't open a second stream if one is already active
    if (streamRef.current) return;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = s;
      setStream(s);
    } catch {
      // permission denied or no camera — fail silently
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  return { stream, start, stop, active: stream !== null };
}
