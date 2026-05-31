"use client";

import { useState } from "react";
import { Surface } from "../ui/Surface";
import { Button } from "../ui/Button";
import { BottomSheet } from "../ui/BottomSheet";
import { CalmLoader } from "../ui/CalmLoader";
import { VitalsPill } from "./VitalsPill";
import { useCameraSession } from "./useCameraSession";

interface CameraPanelProps {
  patientId: string;
  onCameraChange?: (enabled: boolean) => void;
}

export function CameraPanel({ patientId, onCameraChange }: CameraPanelProps) {
  const [consentOpen, setConsentOpen] = useState(false);
  const { enabled, connecting, status, videoRef, toggleCamera } = useCameraSession({
    patientId,
    onCameraChange,
  });

  function handleTurnOnClick() {
    setConsentOpen(true);
  }

  function handleAcceptConsent() {
    setConsentOpen(false);
    void toggleCamera();
  }

  return (
    <>
      <Surface>
        <h2 className="text-section-title">Video check-in (optional)</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Turning on your camera lets the care team see how you&apos;re doing while you wait — without
          you having to flag a nurse. We can also estimate your heart rate from the video to spot if
          you may need help sooner.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-muted">
          <li className="flex gap-2">
            <span style={{ color: "var(--accent)" }}>•</span>
            <span>Nurses can check on you visually from the command center</span>
          </li>
          <li className="flex gap-2">
            <span style={{ color: "var(--accent)" }}>•</span>
            <span>Automatic vitals monitoring while your camera is on</span>
          </li>
          <li className="flex gap-2">
            <span style={{ color: "var(--accent)" }}>•</span>
            <span>You can turn it off at any time</span>
          </li>
        </ul>

        <div className="relative mt-5">
          {!enabled && (
            <div
              className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-2"
              aria-hidden={enabled}
            >
              <p className="px-4 text-center text-sm text-muted">
                Your preview appears here after you turn the camera on
              </p>
            </div>
          )}

          {enabled && (
            <div className="camera-feed-correct relative overflow-hidden rounded-xl border border-border">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full bg-slate-950 object-cover"
              />
              {connecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50">
                  <CalmLoader label="Connecting…" />
                </div>
              )}
              {!connecting && (
                <div
                  className="absolute left-2 top-2 rounded-lg px-2 py-1 text-[10px] font-semibold text-white"
                  style={{ background: "rgba(37,99,235,0.85)" }}
                >
                  Camera on — nurse can view
                </div>
              )}
            </div>
          )}
        </div>

        {enabled && /\bHR\s+\d+\s+bpm\b/.test(status) && (
          <div className="mt-4">
            <VitalsPill status={status} />
          </div>
        )}

        <div className="mt-5">
          {!enabled ? (
            <Button fullWidth onClick={handleTurnOnClick} disabled={connecting}>
              Turn on camera
            </Button>
          ) : (
            <Button fullWidth variant="outline" onClick={() => void toggleCamera()}>
              Turn off camera
            </Button>
          )}
        </div>
      </Surface>

      <BottomSheet
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        title="Before you turn on your camera"
      >
        <p className="text-sm leading-relaxed text-muted">
          By continuing, you agree to share live video with the nursing team while your camera is on.
          This helps them monitor your condition in the waiting room.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li className="flex gap-2">
            <span style={{ color: "var(--accent)" }}>•</span>
            <span>Nurses may view your video on their dashboard</span>
          </li>
          <li className="flex gap-2">
            <span style={{ color: "var(--accent)" }}>•</span>
            <span>Audio is never recorded — video only</span>
          </li>
          <li className="flex gap-2">
            <span style={{ color: "var(--accent)" }}>•</span>
            <span>You can turn the camera off whenever you want</span>
          </li>
        </ul>
        <div className="mt-6 flex flex-col gap-3">
          <Button fullWidth onClick={handleAcceptConsent}>
            I understand — turn on camera
          </Button>
          <Button fullWidth variant="ghost" onClick={() => setConsentOpen(false)}>
            Not now
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}
