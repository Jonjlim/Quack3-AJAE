/**
 * Room-camera feed CV: multi-person pose + temporal fall/collapse classification.
 */

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { drawMirroredFrame } from "./camera-orientation";
import {
  DISTRESS_LABEL,
  DISTRESS_STYLE,
  drawPoseSkeleton,
  extractPoseFeatures,
  matchPoseTrackers,
  PoseDistressTracker,
  type DistressState,
} from "./poseDistressClassifier";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

const NUM_POSES = 16;
const MAX_TRACKERS = 30;
const FRAME_SKIP = 3;
const INFER_WIDTH = 1280;

const BOX_LANDMARKS = [0, 11, 12, 13, 14, 23, 24, 25, 26, 27, 28];

function getBoundingBox(lms: NormalizedLandmark[]): { x: number; y: number; w: number; h: number } {
  const pts = BOX_LANDMARKS.map((i) => lms[i]).filter(Boolean);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = (maxX - minX) * 0.15;
  const padY = (maxY - minY) * 0.12;
  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    w: Math.min(1, maxX + padX) - Math.max(0, minX - padX),
    h: Math.min(1, maxY + padY) - Math.max(0, minY - padY),
  };
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  poses: { lms: NormalizedLandmark[]; state: DistressState }[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;

  for (const { lms, state } of poses) {
    // Bounding box pass
    const box = getBoundingBox(lms);
    const style = DISTRESS_STYLE[state];
    const labelText = DISTRESS_LABEL[state];

    const bx = box.x * W;
    const by = box.y * H;
    const bw = box.w * W;
    const bh = box.h * H;

    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = state === "safe" ? 2.5 : 3;
    ctx.fillStyle = style.fill;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = "bold 11px system-ui, sans-serif";
    const textW = ctx.measureText(labelText).width;
    const labelX = bx + 4;
    const labelY = by > 18 ? by - 5 : by + bh + 13;

    ctx.fillStyle = style.stroke + "cc";
    ctx.fillRect(labelX - 2, labelY - 11, textW + 6, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(labelText, labelX + 1, labelY);

    // Skeleton wireframe pass — drawn on top of the box
    drawPoseSkeleton(ctx, canvas, lms, state, 1.5, 2.5);
  }
}

export function createNurseFeedDetector(
  videoEl: HTMLVideoElement,
  overlayCanvas: HTMLCanvasElement,
  onFall?: (detail: { confidence: number; state: "falling" | "collapsed" }) => void,
): { cleanup: () => void; ready: Promise<void> } {
  let alive = true;
  let rafId: number | null = null;
  let landmarker: PoseLandmarker | null = null;
  let frameCount = 0;
  const trackers: PoseDistressTracker[] = [];

  const offscreen = document.createElement("canvas");
  offscreen.width = INFER_WIDTH;
  offscreen.height = Math.round(INFER_WIDTH * (9 / 16));
  const offCtx = offscreen.getContext("2d");

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
      rafId = requestAnimationFrame(tick);

      if (++frameCount % FRAME_SKIP !== 0) return;

      if (videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      if (!vw || !vh) return;

      const dispW = videoEl.offsetWidth || vw;
      const dispH = videoEl.offsetHeight || vh;
      if (overlayCanvas.width !== dispW || overlayCanvas.height !== dispH) {
        overlayCanvas.width = dispW;
        overlayCanvas.height = dispH;
      }

      const inferH = Math.round(vh * (INFER_WIDTH / vw));
      if (offscreen.height !== inferH) offscreen.height = inferH;
      if (offCtx) {
        drawMirroredFrame(offCtx, videoEl, INFER_WIDTH, inferH);
      }

      const result = landmarker.detectForVideo(offscreen, performance.now());
      const now = performance.now();

      const classifiedDetections = result.landmarks
        .map((lms) => {
          const features = extractPoseFeatures(lms);
          return features ? { lms, features } : null;
        })
        .filter((d): d is NonNullable<typeof d> => d != null);

      const pairs = matchPoseTrackers(trackers, classifiedDetections, MAX_TRACKERS, now);

      const trackedStateMap = new Map<NormalizedLandmark[], DistressState>();

      for (const { tracker, lms, features } of pairs) {
        const { state, confidence, shouldAlert } = tracker.update(features, now);
        trackedStateMap.set(lms, state);

        if (shouldAlert && onFall && state !== "safe") {
          onFall({ confidence, state });
        }
      }

      // Draw every detected pose — classified or not
      const drawList = result.landmarks.map((lms) => ({
        lms,
        state: trackedStateMap.get(lms) ?? ("safe" as DistressState),
      }));

      drawOverlay(overlayCanvas, drawList);
    };
    tick();
  })();

  const cleanup = () => {
    alive = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    landmarker?.close();
    landmarker = null;
    trackers.length = 0;
  };

  return { cleanup, ready };
}
