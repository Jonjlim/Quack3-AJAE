import type { RppgAnalysisResult, SceneIntelRppgResponse } from "@shared/types/telemetry";
import { authFetch } from "@/lib/auth-fetch";
import { getApiBase } from "@/lib/api-base";
import { isMockMode } from "@/lib/ws-client";

export type { RppgAnalysisResult, SceneIntelRppgResponse };

function preferredMimeType(): string {
  const candidates = ["video/mp4", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
}

const RPPG_REQUEST_TIMEOUT_MS = 120_000;

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

/**
 * Record from the live preview element — WebRTC tracks cloned for MediaRecorder
 * often produce empty clips while LiveKit is publishing.
 */
export function recordVideoClipFromPreview(
  video: HTMLVideoElement,
  durationMs = 8000,
): Promise<Blob> {
  if (!video.videoWidth || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.reject(new Error("Camera preview not ready"));
  }

  const captureStream = (
    video as HTMLVideoElement & { captureStream?: () => MediaStream }
  ).captureStream;
  if (typeof captureStream === "function") {
    const stream = captureStream.call(video);
    const track = stream.getVideoTracks()[0];
    if (track) {
      return recordVideoClip(track, durationMs);
    }
  }

  const src = video.srcObject;
  if (src instanceof MediaStream) {
    const track = src.getVideoTracks()[0];
    if (track) {
      return recordVideoClip(track, durationMs);
    }
  }

  return Promise.reject(new Error("No camera stream available for vitals"));
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

  const response = await authFetch(
    `${getApiBase()}/api/v1/rppg`,
    {
      method: "POST",
      body: form,
    },
    RPPG_REQUEST_TIMEOUT_MS,
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `rPPG analysis failed (${response.status})`);
  }

  return response.json() as Promise<SceneIntelRppgResponse>;
}
