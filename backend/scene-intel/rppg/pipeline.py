"""Remote photoplethysmography pipeline stub — face ROI to HR/RR estimate."""

from dataclasses import dataclass

import numpy as np


@dataclass
class RPPGResult:
    heart_rate_bpm: float | None
    respiratory_rate_bpm: float | None
    confidence: float


class RPPGPipeline:
    """Stub rPPG pipeline. Replace with optical flow / chrominance analysis."""

    def process_frame(self, frame: np.ndarray, patient_id: str) -> RPPGResult:
        _ = frame, patient_id
        return RPPGResult(
            heart_rate_bpm=None,
            respiratory_rate_bpm=None,
            confidence=0.0,
        )
