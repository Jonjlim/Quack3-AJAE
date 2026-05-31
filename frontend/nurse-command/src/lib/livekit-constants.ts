/** Shared LiveKit room + identity helpers for room camera feeds. */

export const ER_WAITING_ROOM = "er-waiting-room";

/** LiveKit identity prefix for wide-angle room cameras (multiple allowed). */
export const ROOM_CAMERA_PREFIX = "room-cam:";

/** @deprecated Legacy single camera; still treated as a room camera for CV. */
export const LEGACY_BROAD_CAMERA_IDENTITY = "broad-camera";

export function slugifyRoomName(displayName: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unnamed";
}

/** Stable LiveKit identity for a named room (unique per room name). */
export function roomCameraIdentity(displayName: string): string {
  return `${ROOM_CAMERA_PREFIX}${slugifyRoomName(displayName)}`;
}

export function isRoomCameraIdentity(identity: string): boolean {
  return (
    identity.startsWith(ROOM_CAMERA_PREFIX) || identity === LEGACY_BROAD_CAMERA_IDENTITY
  );
}

/** Human-readable label from identity when participant name is unavailable. */
export function roomLabelFromIdentity(identity: string): string {
  if (identity === LEGACY_BROAD_CAMERA_IDENTITY) return "Room camera";
  if (!identity.startsWith(ROOM_CAMERA_PREFIX)) return identity;
  const slug = identity.slice(ROOM_CAMERA_PREFIX.length);
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
