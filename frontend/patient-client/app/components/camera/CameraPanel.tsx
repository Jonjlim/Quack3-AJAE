"use client";

import { Surface } from "../ui/Surface";
import { Button } from "../ui/Button";
import { CalmLoader } from "../ui/CalmLoader";
import { VitalsPill } from "./VitalsPill";
import { useCameraSession } from "./useCameraSession";

interface CameraPanelProps {
  patientId: string;
  onCameraChange?: (enabled: boolean) => void;
}

export function CameraPanel({ patientId, onCameraChange }: CameraPanelProps) {
  const { enabled, connecting, status, videoRef, toggleCamera } = useCameraSession({
    patientId,
    onCameraChange,
  });

  return (
    <Surface>
      <h2 className="text-section-title">Video check-in (optional)</h2>
      <p className="mt-2 text-sm text-muted">
        You may turn on your camera so a nurse can see you while you wait. Heart rate may be
        estimated from your video.
      </p>

      <div className="relative mt-5">
        {!enabled && (
          <div
            className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50"
            aria-hidden={enabled}
          >
            <p className="text-sm text-muted">Camera preview will appear here</p>
          </div>
        )}

        {enabled && (
          <div className="camera-feed-correct relative overflow-hidden rounded-lg border border-neutral-200">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="aspect-video w-full bg-neutral-900 object-cover"
            />
            {connecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/50">
                <CalmLoader label="Connecting…" />
              </div>
            )}
            {!connecting && (
              <div className="absolute left-2 top-2 rounded-md border border-neutral-200 bg-surface px-2 py-1 text-xs font-medium text-ink">
                Camera on — nurse can view
              </div>
            )}
          </div>
        )}
      </div>

      {enabled && (
        <div className="mt-4">
          <VitalsPill status={status} />
        </div>
      )}

      <div className="mt-5">
        {!enabled ? (
          <Button fullWidth onClick={() => void toggleCamera()} disabled={connecting}>
            Turn on camera
          </Button>
        ) : (
          <Button fullWidth variant="outline" onClick={() => void toggleCamera()}>
            Turn off camera
          </Button>
        )}
      </div>
    </Surface>
  );
}
