import type { RppgAnalysisResult, SceneIntelRppgResponse } from "@shared/types/telemetry";
import { getApiBase } from "@/lib/api-base";
import { isMockMode } from "@/lib/ws-client";

export type { RppgAnalysisResult, SceneIntelRppgResponse };

function preferredMimeType(): string {
  const candidates = ["video/mp4", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
}

/** Record a short clip from a camera track for rPPG analysis (~8s). */
export function recordVideoClip(
  track: MediaStreamTrack,
  durationMs = 8000,
): Promise<Blob> {
  const stream = new MediaStream([track]);
  const mimeType = preferredMimeType();

  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1_500_000,
    });

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => reject(new Error("Video recording failed"));
    recorder.onstop = () => {
      if (chunks.length === 0) {
        reject(new Error("No video data captured"));
        return;
      }
      resolve(new Blob(chunks, { type: mimeType }));
    };

    recorder.start(250);
    setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, durationMs);
  });
}

/** POST a video clip to backend rPPG and apply biometrics on the triage engine. */
export async function submitRppgClip(
  patientId: string,
  blob: Blob,
): Promise<SceneIntelRppgResponse> {
  if (isMockMode()) {
    return {
      analysis: {
        heart_rate_bpm: 72,
        heart_rate_bpm_low: 68,
        heart_rate_bpm_high: 76,
        confidence: 0.85,
        signal_quality: "good",
        measurement_status: "reliable",
        quality_metrics: {
          face_coverage: 0.92,
          motion_score: 0.08,
          peak_prominence: 0.78,
          chrom_fft_agreement_bpm: 2.0,
        },
        error: null,
      },
      biometric: {
        patient_id: patientId,
        heart_rate_bpm: 72,
        heart_rate_bpm_low: 68,
        heart_rate_bpm_high: 76,
        respiratory_rate_bpm: null,
        confidence: 0.85,
        measurement_status: "reliable",
        source: "rppg",
        recorded_at: new Date().toISOString(),
      },
      alert: null,
      broadcast: false,
    };
  }

  const extension = blob.type.includes("mp4") ? "mp4" : "webm";
  const form = new FormData();
  form.append("patient_id", patientId);
  form.append("video", blob, `rppg-clip.${extension}`);

  const response = await fetch(`${getApiBase()}/api/v1/rppg`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `rPPG analysis failed (${response.status})`);
  }

  return response.json() as Promise<SceneIntelRppgResponse>;
}
