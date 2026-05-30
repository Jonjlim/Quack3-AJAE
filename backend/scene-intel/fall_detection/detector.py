"""Fall detection stub using consecutive-frame thresholding."""

from dataclasses import dataclass, field

import numpy as np


@dataclass
class FallDetector:
    consecutive_threshold: int = 3
    _consecutive_flags: int = field(default=0, init=False)

    def analyze_frame(self, frame: np.ndarray) -> bool:
        """
        Stub detector — returns True when `consecutive_threshold` frames
        in a row are flagged. Replace with MediaPipe Pose / YOLO logic.
        """
        _ = frame
        return False

    def flag_frame(self) -> bool:
        """Call when an external model flags a frame as a potential fall."""
        self._consecutive_flags += 1
        return self._consecutive_flags >= self.consecutive_threshold

    def reset(self) -> None:
        self._consecutive_flags = 0
