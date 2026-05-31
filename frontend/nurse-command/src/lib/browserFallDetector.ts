/** In-browser fall detection from a live camera stream (no server-side video upload). */

export interface FallDetectionEvent {
  confidence: number;
  danger_level: "medium" | "high";
  coordinates?: { x: number; y: number };
  frame_timestamp?: number;
}

const SAMPLE_MS = 250;
const HISTORY_LEN = 12;
const MOTION_SPIKE = 28;
const DROP_AFTER_SPIKE = 14;
const FALL_COOLDOWN_MS = 45_000;

function luminanceAt(data: Uint8ClampedArray, width: number, x: number, y: number): number {
  const i = (y * width + x) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

function lowerBandMotionDelta(
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray,
  width: number,
  height: number,
): { delta: number; centroidY: number } {
  const yStart = Math.floor(height * 0.55);
  let sum = 0;
  let weightedY = 0;
  let count = 0;

  for (let y = yStart; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const diff = Math.abs(luminanceAt(current, width, x, y) - luminanceAt(previous, width, x, y));
      if (diff > 18) {
        sum += diff;
        weightedY += y * diff;
        count++;
      }
    }
  }

  if (count === 0) return { delta: 0, centroidY: height * 0.8 };
  return { delta: sum / count, centroidY: weightedY / sum };
}

/**
 * Samples frames from `stream` and calls `onFall` when a rapid drop-like motion pattern is seen.
 * Returns a cleanup function.
 */
export function createBrowserFallDetector(
  stream: MediaStream,
  onFall: (event: FallDetectionEvent) => void,
): () => void {
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  void video.play().catch(() => undefined);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  let previous: ImageData | null = null;
  const motionHistory: number[] = [];
  let lastAlertAt = 0;
  let spikeIndex = -1;

  const interval = setInterval(() => {
    if (!ctx || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

    const width = video.videoWidth || 320;
    const height = video.videoHeight || 240;
    if (width < 64 || height < 64) return;

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);
    const current = ctx.getImageData(0, 0, width, height);

    if (previous) {
      const { delta, centroidY } = lowerBandMotionDelta(
        current.data,
        previous.data,
        width,
        height,
      );
      motionHistory.push(delta);
      if (motionHistory.length > HISTORY_LEN) motionHistory.shift();

      const recent = motionHistory;
      const peak = Math.max(...recent);
      const latest = recent[recent.length - 1] ?? 0;

      if (peak >= MOTION_SPIKE) {
        spikeIndex = recent.indexOf(peak);
      }

      const cooledDown = Date.now() - lastAlertAt > FALL_COOLDOWN_MS;
      const dropDetected =
        spikeIndex >= 0 &&
        peak >= MOTION_SPIKE &&
        latest <= DROP_AFTER_SPIKE &&
        recent.length - spikeIndex <= 5;

      if (dropDetected && cooledDown) {
        const confidence = Math.min(0.95, 0.55 + peak / 120);
        lastAlertAt = Date.now();
        spikeIndex = -1;
        motionHistory.length = 0;
        onFall({
          confidence,
          danger_level: confidence >= 0.75 ? "high" : "medium",
          coordinates: {
            x: Math.round(width / 2),
            y: Math.round(centroidY),
          },
          frame_timestamp: video.currentTime,
        });
      }
    }

    previous = current;
  }, SAMPLE_MS);

  return () => {
    clearInterval(interval);
    video.pause();
    video.srcObject = null;
    previous = null;
  };
}
