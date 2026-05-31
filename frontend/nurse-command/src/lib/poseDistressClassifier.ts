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

const HISTORY_MS = 7_000;
const UPRIGHT_LOOKBACK_MS = 5_000;

const UPRIGHT_TORSO_DY_MIN = 0.2;
const UPRIGHT_ANGLE_MAX = 38;

/** Normalized downward movement of body center in this window → rapid fall (visual only). */
const RAPID_DROP_WINDOW_MS = 450;
const RAPID_DROP_CENTER_Y = 0.055;
const RAPID_TORSO_COLLAPSE_DY = 0.1;

/**
 * Person must be continuously horizontal for this long before being considered unconscious.
 * 1.5 seconds rules out momentary bending/crouching while still being fast enough for
 * real emergencies. The isStronglyHorizontal (score ≥ 5) + isStill guards prevent false
 * positives from the lower time window.
 */
const SUSTAINED_HORIZONTAL_MS = 1_500;

/**
 * Stillness check: if the body center range across this window exceeds STILL_MAX_DRIFT
 * in either axis the person is considered to be actively moving (not unconscious).
 */
const STILL_WINDOW_MS = 2_000;
const STILL_MAX_DRIFT = 0.08; // 8 % of normalised frame

const MIN_VISIBILITY = 0.25;

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

  // Only one visible shoulder and one visible hip are required — handles partially
  // occluded people in crowds where not all four landmarks pass the visibility gate.
  const anyShoulder = ls ?? rs;
  const anyHip = lh ?? rh;
  if (!anyShoulder || !anyHip) return null;

  const shoulderY = ls && rs ? (ls.y + rs.y) / 2 : anyShoulder.y;
  const shoulderX = ls && rs ? (ls.x + rs.x) / 2 : anyShoulder.x;
  const hipY = lh && rh ? (lh.y + rh.y) / 2 : anyHip.y;
  const hipX = lh && rh ? (lh.x + rh.x) / 2 : anyHip.x;
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

/**
 * Returns a 0–10 prone score.  Each sub-signal is independently weighted so a
 * partial detection (e.g. only upper body visible) can still produce a useful score.
 *
 * Approximate ranges:
 *   Upright walking/standing: 0–2
 *   Sitting on floor:         1–3
 *   Bending over briefly:     3–5
 *   Falling / mid-collapse:   4–7
 *   Lying flat (unconscious): 7–10
 */
function horizontalScore(f: PoseFeatures): number {
  let s = 0;

  // Torso vertical collapse: hip Y ≈ shoulder Y
  if (f.torsoDy < 0.04) s += 3;
  else if (f.torsoDy < 0.10) s += 2;
  else if (f.torsoDy < 0.15) s += 1;

  // Torso angle from vertical (0° = upright, 90° = flat)
  if (f.torsoAngleDeg >= 70) s += 3;
  else if (f.torsoAngleDeg >= 58) s += 2;
  else if (f.torsoAngleDeg >= 44) s += 1;

  // Bounding-box aspect ratio (width / height)
  if (f.aspectRatio >= 2.0) s += 2;
  else if (f.aspectRatio >= 1.3) s += 1;

  // Head at same height as hips — strongest single signal for "lying flat"
  if (f.headY >= f.hipY - 0.02) s += 2;
  else if (f.headY >= f.hipY - 0.07) s += 1;

  return s; // max 10
}

/** Broad horizontal gate — drives "falling" visual state. */
function isHorizontal(f: PoseFeatures): boolean {
  return horizontalScore(f) >= 4;
}

/** Strongly horizontal — required before classifying as "collapsed". */
function isStronglyHorizontal(f: PoseFeatures): boolean {
  return horizontalScore(f) >= 5;
}

/**
 * Returns true when the body centre hasn't moved more than STILL_MAX_DRIFT in
 * either axis over the last STILL_WINDOW_MS.
 */
function isStill(samples: HistorySample[], now: number): boolean {
  const window = samples.filter((s) => now - s.t <= STILL_WINDOW_MS);
  if (window.length < 4) return false;
  const xs = window.map((s) => s.f.centerX);
  const ys = window.map((s) => s.f.centerY);
  const rangeX = Math.max(...xs) - Math.min(...xs);
  const rangeY = Math.max(...ys) - Math.min(...ys);
  return rangeX < STILL_MAX_DRIFT && rangeY < STILL_MAX_DRIFT;
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
  /** Timestamp of the last successful update — used to expire stale trackers. */
  lastSeenAt = 0;

  constructor(private readonly alertCooldownMs = 15_000) {}

  /**
   * Call at the top of each detection round.
   * If this tracker hasn't been matched to a detection in staleness ms, its history is
   * wiped so a new person inheriting the tracker slot starts with a clean slate.
   */
  pruneIfStale(now: number, staleMs = 2_000): void {
    if (this.lastSeenAt > 0 && now - this.lastSeenAt > staleMs) {
      this.samples = [];
      this.state = "safe";
    }
  }

  update(features: PoseFeatures, now = performance.now()): DistressClassification {
    this.lastSeenAt = now;
    this.samples = pruneHistory([...this.samples, { t: now, f: features }], now);

    const upright = isUpright(features);
    const horizontal = isHorizontal(features);
    const hadUpright = wasUprightRecently(this.samples, now);
    const rapid = isRapidDescent(this.samples, now, features);
    const horizontalMs = horizontalDurationMs(this.samples, now);

    let next: DistressState = "safe";
    let confidence = 0.5;

    if (horizontal) {
      const strong = isStronglyHorizontal(features);
      // Allow collapse even without prior upright history if prone for a moderate time
      // (person collapsed before entering camera view — 4 s covers most real scenarios).
      const qualifies = hadUpright || horizontalMs >= 4_000;

      if (horizontalMs >= SUSTAINED_HORIZONTAL_MS && qualifies) {
        next = strong ? "collapsed" : "falling";
        confidence = strong ? 0.88 : 0.65;
      } else if (rapid && hadUpright) {
        next = "falling";
        confidence = 0.75;
      } else if (hadUpright) {
        next = "falling";
        confidence = 0.55;
      }
    } else if (!horizontal && rapid && hadUpright && features.torsoAngleDeg >= 22) {
      next = "falling";
      confidence = 0.7;
    } else if (upright) {
      next = "safe";
      confidence = 0.9;
    }

    this.state = next;

    /**
     * Alert ONLY when:
     * 1. Clearly in "collapsed" state (5+ s horizontal, 2-of-4 signals).
     * 2. Person is motionless (rules out sitting, crouching, adjusting).
     * 3. Cooldown has elapsed (avoid alert spam).
     * "Falling" state never triggers an alert — too noisy.
     */
    const shouldAlert =
      next === "collapsed" &&
      isStill(this.samples, now) &&
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

/**
 * Match detections to trackers by nearest body centre with a distance gate.
 *
 * The distance gate (~20 % of frame width/height) prevents trackers from jumping
 * between people in crowded scenes. Detections that fall outside the gate get a
 * fresh tracker (up to maxTracks). Trackers that haven't been matched for 2 s have
 * their history wiped via pruneIfStale() so the slot can be safely reused.
 */
export function matchPoseTrackers(
  trackers: PoseDistressTracker[],
  detections: PoseDetection[],
  maxTracks: number,
  now: number,
): { tracker: PoseDistressTracker; lms: NormalizedLandmark[]; features: PoseFeatures }[] {
  const pool = trackers;

  // Expire stale trackers before matching so inherited history is clean.
  for (const t of pool) {
    t.pruneIfStale(now);
  }

  // Maximum squared distance to consider two body centres the same person.
  const MAX_DIST_SQ = 0.2 * 0.2;

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
      const t = pool[i];
      const d =
        (det.features.centerX - t.lastCenterX) ** 2 +
        (det.features.centerY - t.lastCenterY) ** 2;
      if (d < bestDist && d < MAX_DIST_SQ) {
        bestDist = d;
        bestIdx = i;
      }
    }

    if (bestIdx >= 0) {
      used.add(bestIdx);
      pairs.push({ tracker: pool[bestIdx], lms: det.lms, features: det.features });
    } else if (pool.length < maxTracks) {
      // New person not near any existing tracker — give them a fresh one.
      const fresh = new PoseDistressTracker();
      const freshIdx = pool.length;
      pool.push(fresh);
      used.add(freshIdx);
      pairs.push({ tracker: fresh, lms: det.lms, features: det.features });
    }
    // At capacity and no match — skip. Rare with maxTracks=25 and numPoses=8.
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

/** Full MediaPipe BlazePose 33-landmark connection set for wireframe rendering. */
export const SKELETON_CONNECTIONS: readonly [number, number][] = [
  // Face outline
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
  // Shoulders
  [11, 12],
  // Left arm
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  // Right arm
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // Torso
  [11, 23], [12, 24], [23, 24],
  // Left leg
  [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [28, 32], [30, 32],
];

/**
 * Draws a single-person wireframe skeleton onto `ctx`.
 * Joints with low visibility are skipped so partial detections still look clean.
 */
export function drawPoseSkeleton(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  lms: NormalizedLandmark[],
  state: DistressState,
  lineWidth = 2,
  dotRadius = 3.5,
): void {
  const style = DISTRESS_STYLE[state];
  const W = canvas.width;
  const H = canvas.height;

  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const [a, b] of SKELETON_CONNECTIONS) {
    const pA = lms[a];
    const pB = lms[b];
    if (!pA || !pB) continue;
    if ((pA.visibility ?? 1) < 0.12 || (pB.visibility ?? 1) < 0.12) continue;
    ctx.strokeStyle = style.skeleton;
    ctx.globalAlpha = Math.min((pA.visibility ?? 1), (pB.visibility ?? 1)) * 0.85 + 0.15;
    ctx.beginPath();
    ctx.moveTo(pA.x * W, pA.y * H);
    ctx.lineTo(pB.x * W, pB.y * H);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.fillStyle = style.dots;
  for (const lm of lms) {
    if ((lm.visibility ?? 1) < 0.12) continue;
    ctx.beginPath();
    ctx.arc(lm.x * W, lm.y * H, dotRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
