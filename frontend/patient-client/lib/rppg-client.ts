import type { BiometricReading } from "@shared/types/telemetry";
import { isMockMode } from "@/lib/ws-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface RppgAnalysisResult {
  heart_rate_bpm: number | null;
  confidence: number;
  signal_quality: "good" | "fair" | "poor";
  error: string | null;
}

export interface SceneIntelRppgResponse {
  analysis: RppgAnalysisResult;
  biometric: BiometricReading | null;
  broadcast: boolean;
}

function preferredMimeType(): string {
  const candidates = ["video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "video/webm";
}

/** Record a short clip from a camera track for rPPG analysis (~5s, ≥30 frames). */
export function recordVideoClip(
  track: MediaStreamTrack,
  durationMs = 5000,
): Promise<Blob> {
  const stream = new MediaStream([track]);
  const mimeType = preferredMimeType();

  return new Promise((resolve, reject) => {
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 500_000,
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

/** POST a video clip to scene-intel rPPG and apply biometrics on the backend. */
export async function submitRppgClip(
  patientId: string,
  blob: Blob,
): Promise<SceneIntelRppgResponse> {
  if (isMockMode()) {
    return {
      analysis: {
        heart_rate_bpm: 72,
        confidence: 0.85,
        signal_quality: "good",
        error: null,
      },
      biometric: {
        patient_id: patientId,
        heart_rate_bpm: 72,
        respiratory_rate_bpm: null,
        confidence: 0.85,
        source: "rppg",
        recorded_at: new Date().toISOString(),
      },
      broadcast: false,
    };
  }

  const extension = blob.type.includes("mp4") ? "mp4" : "webm";
  const form = new FormData();
  form.append("patient_id", patientId);
  form.append("video", blob, `rppg-clip.${extension}`);

  const response = await fetch(`${API_BASE}/api/v1/scene-intel/rppg`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `rPPG analysis failed (${response.status})`);
  }

  return response.json() as Promise<SceneIntelRppgResponse>;
}
