import type { BiometricReading } from "@shared/types/telemetry";
import { useEffect, useRef } from "react";
import {
  recordVideoClip,
  submitRppgClip,
  type RppgAnalysisResult,
} from "@/lib/rppg-client";
import { isMockMode } from "@/lib/ws-client";

const WARMUP_MS = 2000;
const SAMPLE_INTERVAL_MS = 15_000;
const CLIP_DURATION_MS = 5000;

export interface UseRppgSamplerOptions {
  patientId: string;
  track: MediaStreamTrack | null;
  enabled: boolean;
  onSample?: (result: {
    reading: BiometricReading | null;
    analysis: RppgAnalysisResult;
  }) => void;
}

/** Periodically records camera clips and sends them for rPPG heart-rate analysis. */
export function useRppgSampler({
  patientId,
  track,
  enabled,
  onSample,
}: UseRppgSamplerOptions): void {
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;

  useEffect(() => {
    if (!enabled || !track) return;

    let cancelled = false;
    let inFlight = false;

    const sample = async () => {
      if (cancelled || inFlight || !track || track.readyState === "ended") return;

      inFlight = true;
      try {
        const blob = await recordVideoClip(track, CLIP_DURATION_MS);
        if (cancelled) return;

        const response = await submitRppgClip(patientId, blob);
        if (cancelled) return;

        onSampleRef.current?.({
          reading: response.biometric,
          analysis: response.analysis,
        });
      } catch {
        // Fail gracefully — camera stream and LiveKit publish continue
      } finally {
        inFlight = false;
      }
    };

    if (isMockMode()) return;

    const warmup = setTimeout(sample, WARMUP_MS);
    const interval = setInterval(sample, SAMPLE_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearTimeout(warmup);
      clearInterval(interval);
    };
  }, [enabled, patientId, track]);
}
