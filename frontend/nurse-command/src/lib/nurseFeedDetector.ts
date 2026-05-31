/**
 * Nurse-feed CV: runs MediaPipe PoseLandmarker on a remote LiveKit video element
 * and draws coloured bounding boxes for each detected person.
 *
 * Optimisations vs the camera-device detector:
 *  - Frame skip: processes every 2nd frame (~30 fps effective) — boxes are visual-only
 *  - Downscale: inference runs on a 640-px-wide offscreen copy; display canvas is native res
 *  - numPoses: 4 — patient + nurse + up to 2 staff/visitors, realistic for an ER bay
 */

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

const NUM_POSES = 2;
const FRAME_SKIP = 3;    // process every 3rd frame (~20 fps) — boxes are visual-only
const INFER_WIDTH = 640; // full model at 640px is fast enough and multi-person accurate

// Must match the camera-device threshold so both views agree on "fallen"
const FALL_THRESHOLD = 0.12;

type PoseState = "safe" | "fallen";

const STATE_STYLE: Record<PoseState, { stroke: string; fill: string; label: string }> = {
  safe:   { stroke: "#22c55e", fill: "#22c55e18", label: "Safe" },
  fallen: { stroke: "#ef4444", fill: "#ef444428", label: "FALLEN" },
};

// Key body landmark indices used for bounding-box computation.
// Excludes hands/feet which can be noisy and extend the box unnecessarily.
const BOX_LANDMARKS = [0, 11, 12, 13, 14, 23, 24, 25, 26, 27, 28];

function classifyPose(lms: NormalizedLandmark[]): PoseState {
  if (lms.length < 25) return "safe";
  const shoulderY = (lms[11].y + lms[12].y) / 2;
  const hipY = (lms[23].y + lms[24].y) / 2;
  return hipY - shoulderY < FALL_THRESHOLD ? "fallen" : "safe";
}

function getBoundingBox(lms: NormalizedLandmark[]): { x: number; y: number; w: number; h: number } {
  const pts = BOX_LANDMARKS.map((i) => lms[i]).filter(Boolean);
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // Add padding so the box isn't too tight around the pose
  const padX = (maxX - minX) * 0.15;
  const padY = (maxY - minY) * 0.12;
  return {
    x: Math.max(0, minX - padX),
    y: Math.max(0, minY - padY),
    w: Math.min(1, maxX + padX) - Math.max(0, minX - padX),
    h: Math.min(1, maxY + padY) - Math.max(0, minY - padY),
  };
}

function drawBoxes(
  canvas: HTMLCanvasElement,
  poses: { lms: NormalizedLandmark[]; state: PoseState }[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const W = canvas.width;
  const H = canvas.height;

  for (const { lms, state } of poses) {
    const box = getBoundingBox(lms);
    const style = STATE_STYLE[state];

    const bx = box.x * W;
    const by = box.y * H;
    const bw = box.w * W;
    const bh = box.h * H;

    // Box fill + stroke
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 2.5;
    ctx.fillStyle = style.fill;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 6);
    ctx.fill();
    ctx.stroke();

    // State label — above the box, or below if too close to the top
    const labelText = style.label;
    ctx.font = "bold 11px system-ui, sans-serif";
    const textW = ctx.measureText(labelText).width;
    const labelX = bx + 4;
    const labelY = by > 18 ? by - 5 : by + bh + 13;

    ctx.fillStyle = style.stroke + "cc";
    ctx.fillRect(labelX - 2, labelY - 11, textW + 6, 14);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(labelText, labelX + 1, labelY);
  }
}

/**
 * Attaches a pose-detection loop to an existing <video> element and draws
 * coloured bounding boxes on `overlayCanvas`.
 *
 * The caller is responsible for sizing and positioning `overlayCanvas` over the video.
 */
export function createNurseFeedDetector(
  videoEl: HTMLVideoElement,
  overlayCanvas: HTMLCanvasElement,
): { cleanup: () => void; ready: Promise<void> } {
  let alive = true;
  let rafId: number | null = null;
  let landmarker: PoseLandmarker | null = null;
  let frameCount = 0;

  // Persistent offscreen canvas for downscaled inference (avoids re-allocating each tick)
  const offscreen = document.createElement("canvas");
  offscreen.width = INFER_WIDTH;
  offscreen.height = Math.round(INFER_WIDTH * (9 / 16)); // safe initial guess
  const offCtx = offscreen.getContext("2d");

  const ready = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: NUM_POSES,
      });
    } catch {
      // GPU unavailable — fall back to CPU
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: NUM_POSES,
      });
    }
    if (!alive) { landmarker.close(); return; }

    const tick = () => {
      if (!alive || !landmarker) return;
      rafId = requestAnimationFrame(tick);

      // Frame skip — visual boxes don't need 60 fps
      if (++frameCount % FRAME_SKIP !== 0) return;

      if (videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      if (!vw || !vh) return;

      // Keep overlay canvas matched to the video element's current display size
      const dispW = videoEl.offsetWidth || vw;
      const dispH = videoEl.offsetHeight || vh;
      if (overlayCanvas.width !== dispW || overlayCanvas.height !== dispH) {
        overlayCanvas.width = dispW;
        overlayCanvas.height = dispH;
      }

      // Downscale video into offscreen canvas for faster inference
      const inferH = Math.round(vh * (INFER_WIDTH / vw));
      if (offscreen.height !== inferH) offscreen.height = inferH;
      offCtx?.drawImage(videoEl, 0, 0, INFER_WIDTH, inferH);

      const result = landmarker.detectForVideo(offscreen, performance.now());

      const poses = result.landmarks.map((lms) => ({
        lms,
        state: classifyPose(lms),
      }));

      drawBoxes(overlayCanvas, poses);
    };
    tick();
  })();

  const cleanup = () => {
    alive = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    landmarker?.close();
    landmarker = null;
  };

  return { cleanup, ready };
}
