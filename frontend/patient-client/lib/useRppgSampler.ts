import type { BiometricReading, RppgAnalysisResult } from "@shared/types/telemetry";
import { useEffect, useRef } from "react";
import { recordVideoClip, submitRppgClip } from "@/lib/rppg-client";
import { isMockMode } from "@/lib/ws-client";

const WARMUP_MS = 3500;
const SAMPLE_INTERVAL_MS = 10_000;
const CLIP_DURATION_MS = 8000;
const MAX_RETRIES = 2;

export interface UseRppgSamplerOptions {
  patientId: string;
  track: MediaStreamTrack | null;
  enabled: boolean;
  onSample?: (result: {
    reading: BiometricReading | null;
    analysis: RppgAnalysisResult;
  }) => void;
  onError?: (message: string) => void;
}

async function submitWithRetry(
  patientId: string,
  blob: Blob,
  onError?: (message: string) => void,
): Promise<Awaited<ReturnType<typeof submitRppgClip>>> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await submitRppgClip(patientId, blob);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("rPPG analysis failed");
      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }
  const message = lastError?.message ?? "rPPG analysis failed";
  onError?.(message);
  throw lastError ?? new Error(message);
}

/** Periodically records camera clips and sends them for rPPG heart-rate analysis. */
export function useRppgSampler({
  patientId,
  track,
  enabled,
  onSample,
  onError,
}: UseRppgSamplerOptions): void {
  const onSampleRef = useRef(onSample);
  const onErrorRef = useRef(onError);
  onSampleRef.current = onSample;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled || !track) return;

    let cancelled = false;
    let inFlight = false;

    const sample = async () => {
      if (cancelled || inFlight || !track || track.readyState === "ended") return;

      inFlight = true;
      try {
        const recordTrack = track.clone();
        const blob = await recordVideoClip(recordTrack, CLIP_DURATION_MS);
        recordTrack.stop();
        if (cancelled) return;

        const response = await submitWithRetry(patientId, blob, (msg) => {
          onErrorRef.current?.(msg);
        });
        if (cancelled) return;

        onSampleRef.current?.({
          reading: response.biometric,
          analysis: response.analysis,
        });
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Vitals measurement failed";
          onErrorRef.current?.(message);
        }
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
