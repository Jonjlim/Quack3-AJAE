/**
 * Temporal pose analysis for fall-in-progress and collapse / possible unconsciousness.
 * Single-frame "lying horizontal" is not enough — we look for rapid descent from upright
 * and sustained prone posture (or active mid-fall motion).
 */

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type DistressState = "safe" | "falling" | "collapsed";

export interface PoseFeatures {
  centerX: number;
  centerY: number;
  shoulderY: number;
  hipY: number;
  /** Hip minus shoulder Y (standing ≈ 0.25–0.45). */
  torsoDy: number;
  /** Degrees from vertical (0 = upright, 90 = horizontal). */
  torsoAngleDeg: number;
  /** Pose bbox width / height. */
  aspectRatio: number;
  headY: number;
  avgVisibility: number;
}

export interface DistressClassification {
  state: DistressState;
  confidence: number;
  shouldAlert: boolean;
}

interface HistorySample {
  t: number;
  f: PoseFeatures;
}

const HISTORY_MS = 2_500;
const UPRIGHT_LOOKBACK_MS = 2_000;

const UPRIGHT_TORSO_DY_MIN = 0.2;
const UPRIGHT_ANGLE_MAX = 38;

const HORIZONTAL_TORSO_DY_MAX = 0.16;
const HORIZONTAL_ANGLE_MIN = 52;
const HORIZONTAL_ASPECT_MIN = 1.22;

/** Normalized downward movement of body center in this window → rapid fall. */
const RAPID_DROP_WINDOW_MS = 450;
const RAPID_DROP_CENTER_Y = 0.055;
const RAPID_TORSO_COLLAPSE_DY = 0.1;

const SUSTAINED_HORIZONTAL_MS = 550;

const MIN_VISIBILITY = 0.45;

function lm(
  lms: NormalizedLandmark[],
  i: number,
): NormalizedLandmark | undefined {
  const p = lms[i];
  if (!p || (p.visibility ?? 1) < MIN_VISIBILITY) return undefined;
  return p;
}

export function extractPoseFeatures(lms: NormalizedLandmark[]): PoseFeatures | null {
  if (lms.length < 25) return null;

  const ls = lm(lms, 11);
  const rs = lm(lms, 12);
  const lh = lm(lms, 23);
  const rh = lm(lms, 24);
  const nose = lm(lms, 0);
  if (!ls || !rs || !lh || !rh) return null;

  const shoulderY = (ls.y + rs.y) / 2;
  const hipY = (lh.y + rh.y) / 2;
  const shoulderX = (ls.x + rs.x) / 2;
  const hipX = (lh.x + rh.x) / 2;
  const torsoDy = hipY - shoulderY;

  const dx = hipX - shoulderX;
  const dy = hipY - shoulderY;
  const torsoAngleDeg = (Math.atan2(Math.abs(dx), Math.abs(dy) + 1e-6) * 180) / Math.PI;

  const indices = [0, 11, 12, 13, 14, 23, 24, 25, 26];
  const pts = indices.map((i) => lm(lms, i)).filter(Boolean) as NormalizedLandmark[];
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(0.05, maxX - minX);
  const h = Math.max(0.05, maxY - minY);

  const visSamples = [ls, rs, lh, rh, nose].filter(Boolean) as NormalizedLandmark[];
  const avgVisibility =
    visSamples.reduce((s, p) => s + (p.visibility ?? 1), 0) / visSamples.length;

  return {
    centerX: (shoulderX + hipX) / 2,
    centerY: (shoulderY + hipY) / 2,
    shoulderY,
    hipY,
    torsoDy,
    torsoAngleDeg,
    aspectRatio: w / h,
    headY: nose?.y ?? shoulderY,
    avgVisibility,
  };
}

function isUpright(f: PoseFeatures): boolean {
  return f.torsoDy >= UPRIGHT_TORSO_DY_MIN && f.torsoAngleDeg <= UPRIGHT_ANGLE_MAX;
}

function isHorizontal(f: PoseFeatures): boolean {
  const headNearHips = f.headY >= f.hipY - 0.04;
  return (
    f.torsoDy <= HORIZONTAL_TORSO_DY_MAX ||
    f.torsoAngleDeg >= HORIZONTAL_ANGLE_MIN ||
    f.aspectRatio >= HORIZONTAL_ASPECT_MIN ||
    (f.torsoDy <= 0.2 && headNearHips)
  );
}

function pruneHistory(samples: HistorySample[], now: number): HistorySample[] {
  return samples.filter((s) => now - s.t <= HISTORY_MS);
}

function wasUprightRecently(samples: HistorySample[], now: number): boolean {
  return samples.some((s) => now - s.t <= UPRIGHT_LOOKBACK_MS && isUpright(s.f));
}

function isRapidDescent(samples: HistorySample[], now: number, current: PoseFeatures): boolean {
  const recent = samples.filter((s) => now - s.t <= RAPID_DROP_WINDOW_MS);
  if (recent.length < 2) return false;

  const oldest = recent[0];
  const centerDrop = current.centerY - oldest.f.centerY;
  const torsoCollapse = oldest.f.torsoDy - current.torsoDy;
  const angleRise = current.torsoAngleDeg - oldest.f.torsoAngleDeg;

  return (
    centerDrop >= RAPID_DROP_CENTER_Y ||
    torsoCollapse >= RAPID_TORSO_COLLAPSE_DY ||
    angleRise >= 28
  );
}

function horizontalDurationMs(samples: HistorySample[], now: number): number {
  let start: number | null = null;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i];
    if (isHorizontal(s.f)) {
      start = s.t;
    } else {
      break;
    }
  }
  if (start == null) return 0;
  return now - start;
}

export class PoseDistressTracker {
  private samples: HistorySample[] = [];
  private state: DistressState = "safe";
  private lastAlertAt = 0;
  lastCenterX = 0;
  lastCenterY = 0;

  constructor(private readonly alertCooldownMs = 8_000) {}

  update(features: PoseFeatures, now = performance.now()): DistressClassification {
    this.samples = pruneHistory([...this.samples, { t: now, f: features }], now);

    const upright = isUpright(features);
    const horizontal = isHorizontal(features);
    const hadUpright = wasUprightRecently(this.samples, now);
    const rapid = isRapidDescent(this.samples, now, features);
    const horizontalMs = horizontalDurationMs(this.samples, now);

    let next: DistressState = "safe";
    let confidence = 0.5;

    if (horizontal && hadUpright) {
      if (horizontalMs >= SUSTAINED_HORIZONTAL_MS) {
        next = "collapsed";
        confidence = rapid ? 0.92 : 0.84;
      } else if (rapid || this.state === "falling") {
        next = "falling";
        confidence = rapid ? 0.88 : 0.78;
      } else {
        next = "falling";
        confidence = 0.72;
      }
    } else if (!horizontal && rapid && hadUpright && features.torsoAngleDeg >= 22) {
      // Mid-fall: still rotating / dropping but not fully prone yet
      next = "falling";
      confidence = 0.8;
    } else if (upright) {
      next = "safe";
      confidence = 0.9;
    }

    this.state = next;

    const shouldAlert =
      (next === "collapsed" || (next === "falling" && rapid && confidence >= 0.82)) &&
      now - this.lastAlertAt > this.alertCooldownMs;

    if (shouldAlert) {
      this.lastAlertAt = now;
    }

    this.lastCenterX = features.centerX;
    this.lastCenterY = features.centerY;

    return { state: next, confidence, shouldAlert };
  }

  getState(): DistressState {
    return this.state;
  }
}

export interface PoseDetection {
  lms: NormalizedLandmark[];
  features: PoseFeatures;
}

/** Match detections to trackers by nearest body center (handles pose index swaps). */
export function matchPoseTrackers(
  trackers: PoseDistressTracker[],
  detections: PoseDetection[],
  maxTracks: number,
): { tracker: PoseDistressTracker; lms: NormalizedLandmark[]; features: PoseFeatures }[] {
  const pool = trackers;
  while (pool.length < Math.min(detections.length, maxTracks)) {
    pool.push(new PoseDistressTracker());
  }

  const used = new Set<number>();
  const pairs: {
    tracker: PoseDistressTracker;
    lms: NormalizedLandmark[];
    features: PoseFeatures;
  }[] = [];

  for (const det of detections) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < pool.length; i++) {
      if (used.has(i)) continue;
      const tracker = pool[i];
      const d =
        (det.features.centerX - tracker.lastCenterX) ** 2 +
        (det.features.centerY - tracker.lastCenterY) ** 2;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) continue;
    used.add(bestIdx);
    pairs.push({ tracker: pool[bestIdx], lms: det.lms, features: det.features });
  }

  return pairs;
}

export const DISTRESS_LABEL: Record<DistressState, string> = {
  safe: "Safe",
  falling: "Falling",
  collapsed: "Unconscious",
};

export const DISTRESS_STYLE: Record<
  DistressState,
  { stroke: string; fill: string; skeleton: string; dots: string }
> = {
  safe: {
    stroke: "#22c55e",
    fill: "#22c55e18",
    skeleton: "#22d3ee",
    dots: "#e879f9",
  },
  falling: {
    stroke: "#f97316",
    fill: "#f9731628",
    skeleton: "#fb923c",
    dots: "#fdba74",
  },
  collapsed: {
    stroke: "#ef4444",
    fill: "#ef444428",
    skeleton: "#f87171",
    dots: "#fbbf24",
  },
};
