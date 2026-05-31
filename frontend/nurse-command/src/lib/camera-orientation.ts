/**
 * Camera feeds arrive horizontally mirrored from WebRTC / front cameras.
 * Correction is applied in two places only:
 * 1. Display — CSS on <video> (see index.css `.camera-feed-correct`)
 * 2. Inference — drawMirroredFrame() before MediaPipe (overlays draw in that same space)
 *
 * Do not CSS-flip overlay canvases; text and skeleton would mirror backwards.
 */

export const CAMERA_VIDEO_CLASS = "camera-feed-correct";

/** Draw `source` into the context with a horizontal flip (corrected pixel space). */
export function drawMirroredFrame(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0, width, height);
  ctx.restore();
}
