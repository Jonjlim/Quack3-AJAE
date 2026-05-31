/** In-browser fall / collapse detection using MediaPipe PoseLandmarker + temporal cues. */

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { drawMirroredFrame } from "./camera-orientation";
import {
  DISTRESS_STYLE,
  extractPoseFeatures,
  matchPoseTrackers,
  PoseDistressTracker,
  type DistressState,
} from "./poseDistressClassifier";

export interface FallDetectionEvent {
  confidence: number;
  danger_level: "medium" | "high";
  phase: "falling" | "collapsed";
  coordinates?: { x: number; y: number };
  frame_timestamp?: number;
}

const WASM_PATH = "/mediapipe/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

const NUM_POSES = 4;
const MAX_TRACKERS = 6;

const CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32],
];

function drawSkeletonPose(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  lms: NormalizedLandmark[],
  state: DistressState,
): void {
  const style = DISTRESS_STYLE[state];
  ctx.strokeStyle = style.skeleton;
  ctx.lineWidth = 2.5;
  for (const [a, b] of CONNECTIONS) {
    if (!lms[a] || !lms[b]) continue;
    ctx.beginPath();
    ctx.moveTo(lms[a].x * canvas.width, lms[a].y * canvas.height);
    ctx.lineTo(lms[b].x * canvas.width, lms[b].y * canvas.height);
    ctx.stroke();
  }

  ctx.fillStyle = style.dots;
  for (const lm of lms) {
    ctx.beginPath();
    ctx.arc(lm.x * canvas.width, lm.y * canvas.height, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAllSkeletons(
  canvas: HTMLCanvasElement,
  poses: { lms: NormalizedLandmark[]; state: DistressState }[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const pose of poses) {
    drawSkeletonPose(ctx, canvas, pose.lms, pose.state);
  }
}

/**
 * Starts MediaPipe PoseLandmarker on `stream` and calls `onFall` on rapid fall or collapse.
 * Optionally draws a skeleton overlay on `overlayCanvas`.
 */
export function createBrowserFallDetector(
  stream: MediaStream,
  onFall: (event: FallDetectionEvent) => void,
  overlayCanvas?: HTMLCanvasElement | null,
): { cleanup: () => void; ready: Promise<void> } {
  let alive = true;
  let rafId: number | null = null;
  let landmarker: PoseLandmarker | null = null;
  const trackers: PoseDistressTracker[] = [];

  const inferCanvas = document.createElement("canvas");
  const inferCtx = inferCanvas.getContext("2d");

  const vid = document.createElement("video");
  vid.srcObject = stream;
  vid.muted = true;
  vid.playsInline = true;
  void vid.play().catch(() => undefined);

  const ready = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: NUM_POSES,
      });
    } catch {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: NUM_POSES,
      });
    }
    if (!alive) {
      landmarker.close();
      return;
    }

    const tick = () => {
      if (!alive || !landmarker) return;

      if (vid.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        const canvas = overlayCanvas;
        if (canvas && (canvas.width !== vid.videoWidth || canvas.height !== vid.videoHeight)) {
          canvas.width = vid.videoWidth;
          canvas.height = vid.videoHeight;
        }

        if (!inferCtx || !vid.videoWidth || !vid.videoHeight) {
          rafId = requestAnimationFrame(tick);
          return;
        }
        inferCanvas.width = vid.videoWidth;
        inferCanvas.height = vid.videoHeight;
        drawMirroredFrame(inferCtx, vid, inferCanvas.width, inferCanvas.height);

        const result = landmarker.detectForVideo(inferCanvas, performance.now());
        const now = performance.now();

        const detections = result.landmarks
          .map((lms) => {
            const features = extractPoseFeatures(lms);
            return features ? { lms, features } : null;
          })
          .filter((d): d is NonNullable<typeof d> => d != null);

        const pairs = matchPoseTrackers(trackers, detections, MAX_TRACKERS);

        const overlayPoses: { lms: NormalizedLandmark[]; state: DistressState }[] = [];

        for (const { tracker, lms, features: feat } of pairs) {
          const { state, confidence, shouldAlert } = tracker.update(feat, now);
          overlayPoses.push({ lms, state });

          if (shouldAlert) {
            onFall({
              confidence,
              phase: state === "collapsed" ? "collapsed" : "falling",
              danger_level: state === "collapsed" ? "high" : "medium",
              coordinates: {
                x: Math.round(feat.centerX * vid.videoWidth),
                y: Math.round(feat.centerY * vid.videoHeight),
              },
              frame_timestamp: vid.currentTime,
            });
          }
        }

        if (canvas && overlayPoses.length > 0) {
          drawAllSkeletons(canvas, overlayPoses);
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
    trackers.length = 0;
  };

  return { cleanup, ready };
}
