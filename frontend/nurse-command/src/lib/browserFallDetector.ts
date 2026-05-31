/** In-browser fall detection using MediaPipe PoseLandmarker (no server-side video upload). */

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface FallDetectionEvent {
  confidence: number;
  danger_level: "medium" | "high";
  coordinates?: { x: number; y: number };
  frame_timestamp?: number;
}

const WASM_PATH = "/mediapipe/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const FALL_COOLDOWN_MS = 8_000;
// Normalized Y gap between shoulder midpoint and hip midpoint.
// Standing: ~0.3+. Below this threshold = body is horizontal = fallen.
const FALL_THRESHOLD = 0.12;

const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32],
];

function isFallen(lms: NormalizedLandmark[]): boolean {
  if (lms.length < 25) return false;
  const shoulderY = (lms[11].y + lms[12].y) / 2;
  const hipY = (lms[23].y + lms[24].y) / 2;
  // Y increases downward; standing → hipY significantly > shoulderY.
  return hipY - shoulderY < FALL_THRESHOLD;
}

function drawSkeleton(canvas: HTMLCanvasElement, lms: NormalizedLandmark[], fallen: boolean): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const lineColor = fallen ? "#f87171" : "#22d3ee";
  const dotColor = fallen ? "#fbbf24" : "#e879f9";

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  for (const [a, b] of CONNECTIONS) {
    if (!lms[a] || !lms[b]) continue;
    ctx.beginPath();
    ctx.moveTo(lms[a].x * canvas.width, lms[a].y * canvas.height);
    ctx.lineTo(lms[b].x * canvas.width, lms[b].y * canvas.height);
    ctx.stroke();
  }

  ctx.fillStyle = dotColor;
  for (const lm of lms) {
    ctx.beginPath();
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Starts MediaPipe PoseLandmarker on `stream` and calls `onFall` when a fallen
 * pose is detected. Optionally draws a skeleton overlay on `overlayCanvas`.
 *
 * Returns { cleanup, ready } where:
 *   cleanup — stop detection and release resources
 *   ready   — resolves once the landmarker has loaded and the tick loop starts
 */
export function createBrowserFallDetector(
  stream: MediaStream,
  onFall: (event: FallDetectionEvent) => void,
  overlayCanvas?: HTMLCanvasElement | null,
): { cleanup: () => void; ready: Promise<void> } {
  let alive = true;
  let rafId: number | null = null;
  let landmarker: PoseLandmarker | null = null;
  let lastAlertAt = 0;

  const vid = document.createElement("video");
  vid.srcObject = stream;
  vid.muted = true;
  vid.playsInline = true;
  void vid.play().catch(() => undefined);

  const ready = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    // numPoses: 1 — camera device only needs to track the primary person for fall alerting.
    // Multi-person boxes belong on the nurse feed, not here, to keep mobile perf healthy.
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    } catch {
      // GPU unavailable — fall back to CPU
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    }
    if (!alive) { landmarker.close(); return; }

    const tick = () => {
      if (!alive || !landmarker) return;

      if (vid.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const canvas = overlayCanvas;
        if (canvas && (canvas.width !== vid.videoWidth || canvas.height !== vid.videoHeight)) {
          canvas.width = vid.videoWidth;
          canvas.height = vid.videoHeight;
        }

        const result = landmarker.detectForVideo(vid, performance.now());

        if (result.landmarks.length > 0) {
          const primary = result.landmarks[0];
          const fallen = isFallen(primary);
          if (canvas) drawSkeleton(canvas, primary, fallen);

          if (fallen && Date.now() - lastAlertAt > FALL_COOLDOWN_MS) {
            lastAlertAt = Date.now();
            onFall({
              confidence: 0.87,
              danger_level: "high",
              coordinates: {
                x: Math.round(((primary[23].x + primary[24].x) / 2) * vid.videoWidth),
                y: Math.round(((primary[23].y + primary[24].y) / 2) * vid.videoHeight),
              },
              frame_timestamp: vid.currentTime,
            });
          }
        } else if (canvas) {
          canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    tick();
  })();

  const cleanup = () => {
    alive = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    landmarker?.close();
    landmarker = null;
    vid.pause();
    vid.srcObject = null;
  };

  return { cleanup, ready };
}

