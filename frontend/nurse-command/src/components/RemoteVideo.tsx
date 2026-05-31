import { useEffect, useRef } from "react";

interface RemoteVideoProps {
  track: MediaStreamTrack;
  className?: string;
  label?: string;
}

export function RemoteVideo({ track, className = "", label }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = new MediaStream([track]);
    return () => {
      video.srcObject = null;
    };
  }, [track]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      {label && (
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
          {label}
        </span>
      )}
    </div>
  );
}
