/** In-browser fall / collapse detection using MediaPipe PoseLandmarker + temporal cues. */

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  drawPoseSkeleton,
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

const NUM_POSES = 16;
const MAX_TRACKERS = 30;

function drawAllSkeletons(
  canvas: HTMLCanvasElement,
  poses: { lms: NormalizedLandmark[]; state: DistressState }[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const { lms, state } of poses) {
    drawPoseSkeleton(ctx, canvas, lms, state);
  }
}

/**
 * Starts MediaPipe PoseLandmarker on `stream` and calls `onFall` on collapse.
 * Optionally draws a skeleton overlay on `overlayCanvas`.
 *
 * Inference pipeline:
 *  1. The raw local MediaStream is attached to a hidden <video> element — NO encode/decode
 *     cycle, this is the highest-quality source available in the browser.
 *  2. The video element is passed directly to PoseLandmarker.detectForVideo(), skipping
 *     any intermediate canvas drawing step.
 *  3. Camera feeds are typically front-facing (mirrored). CSS corrects the display via
 *     `.camera-feed-correct > video { transform: scaleX(-1) }`. We apply the same
 *     horizontal flip to landmark X coordinates so the overlay aligns with what's shown.
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
        minPoseDetectionConfidence: 0.3,
        minPosePresenceScore: 0.3,
        minTrackingConfidence: 0.3,
      });
    } catch {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: NUM_POSES,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceScore: 0.3,
        minTrackingConfidence: 0.3,
      });
    }
    if (!alive) {
      landmarker.close();
      return;
    }

    const tick = () => {
      if (!alive || !landmarker) return;

      if (vid.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && vid.videoWidth && vid.videoHeight) {
        const canvas = overlayCanvas;
        if (canvas && (canvas.width !== vid.videoWidth || canvas.height !== vid.videoHeight)) {
          canvas.width = vid.videoWidth;
          canvas.height = vid.videoHeight;
        }

        // Feed the raw video element directly — no intermediate canvas decode step.
        const result = landmarker.detectForVideo(vid, performance.now());
        const now = performance.now();

        // Flip X to match CSS scaleX(-1) on the display video.
        const landmarks = result.landmarks.map((lms) =>
          lms.map((lm) => ({ ...lm, x: 1 - lm.x })),
        );

        // Extract features only for poses where key landmarks are visible enough.
        // Unclassified poses are still drawn (state: "safe") so the overlay never flickers.
        const classifiedDetections = landmarks
          .map((lms) => {
            const features = extractPoseFeatures(lms);
            return features ? { lms, features } : null;
          })
          .filter((d): d is NonNullable<typeof d> => d != null);

        const pairs = matchPoseTrackers(trackers, classifiedDetections, MAX_TRACKERS, now);

        const trackedStateMap = new Map<NormalizedLandmark[], DistressState>();

        for (const { tracker, lms, features: feat } of pairs) {
          const { state, confidence, shouldAlert } = tracker.update(feat, now);
          trackedStateMap.set(lms, state);

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

        // Draw every detected pose — classified or not
        const overlayPoses = landmarks.map((lms) => ({
          lms,
          state: trackedStateMap.get(lms) ?? ("safe" as DistressState),
        }));

        if (canvas) {
          if (overlayPoses.length > 0) {
            drawAllSkeletons(canvas, overlayPoses);
          } else {
            canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
          }
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
