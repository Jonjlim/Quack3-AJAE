"""Per-room rolling snapshot buffer for multi-frame fall detection.

The frontend sends one JPEG snapshot per second.  When a new snapshot arrives,
the store returns four frames evenly spaced across the last 9 seconds:

    Frame 1 — 9 s ago  (oldest)
    Frame 2 — 6 s ago
    Frame 3 — 3 s ago
    Frame 4 — NOW      (current)

Gemini receives these four frames in order and reasons about the trajectory of
movement across the 9-second window — far more informative than a single
before/after pair.

Returns None while the buffer hasn't accumulated 10 entries yet (first ~10 s).

Thread safety: one lock guards the internal dict so concurrent requests for
different rooms never race.
"""

import threading
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone

# Seconds-ago offsets for the four frames sent to Gemini (oldest → newest)
FRAME_OFFSETS_S: tuple[int, ...] = (9, 6, 3, 0)

# Buffer must hold at least max(FRAME_OFFSETS_S) + 1 = 10 entries.
# Keep 14 so evictions don't immediately drop us below the threshold.
HISTORY_DEPTH: int = 14


@dataclass
class SnapshotEntry:
    image_bytes: bytes
    mime_type: str
    received_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class RoomSnapshotStore:
    """Thread-safe rolling buffer of camera snapshots keyed by room name."""

    def __init__(self) -> None:
        self._rooms: dict[str, deque[SnapshotEntry]] = {}
        self._lock = threading.Lock()

    def push(
        self,
        room_key: str,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
    ) -> list[SnapshotEntry] | None:
        """Add a snapshot and return a chronological 4-frame sequence for Gemini.

        After appending, buf[-1] is the current frame.  Each offset O means
        buf[-(O+1)] — e.g. offset=9 → buf[-10].

        Returns:
            None                    — fewer than 10 snapshots buffered yet.
            list[SnapshotEntry]     — [t-9s, t-6s, t-3s, t-0s] once ready.
        """
        entry = SnapshotEntry(image_bytes=image_bytes, mime_type=mime_type)
        with self._lock:
            if room_key not in self._rooms:
                self._rooms[room_key] = deque(maxlen=HISTORY_DEPTH)
            buf = self._rooms[room_key]
            buf.append(entry)

            required = max(FRAME_OFFSETS_S) + 1  # 10
            if len(buf) < required:
                return None  # still warming up

            return [buf[-(offset + 1)] for offset in FRAME_OFFSETS_S]

    def clear(self, room_key: str) -> None:
        """Discard all snapshots for a room (e.g. when the camera disconnects)."""
        with self._lock:
            self._rooms.pop(room_key, None)


# Module-level singleton shared across all requests
snapshot_store = RoomSnapshotStore()
