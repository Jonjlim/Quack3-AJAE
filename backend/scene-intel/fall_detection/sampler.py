"""Sample frames from a video stream at a configurable interval."""

from collections.abc import Iterator

import cv2
import numpy as np


def sample_frames(
    source: str | int,
    every_n_frames: int = 30,
    max_frames: int | None = None,
) -> Iterator[tuple[int, np.ndarray]]:
    """
    Yield (frame_index, frame) every `every_n_frames` frames from `source`.
    `source` may be a file path or camera index (0).
    """
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video source: {source}")

    frame_index = 0
    yielded = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_index % every_n_frames == 0:
                yield frame_index, frame
                yielded += 1
                if max_frames is not None and yielded >= max_frames:
                    break
            frame_index += 1
    finally:
        cap.release()
