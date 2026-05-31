"""Unit tests for rPPG analysis (no MediaPipe / video required)."""

from unittest.mock import patch

import numpy as np
import pytest

from rppg.rppg import (
    _chrom_signal,
    _compute_ci,
    _composite_confidence,
    _measurement_status,
    detect_rppg,
)


class TestChromSignal:
    def test_chrom_output_length_matches_input(self) -> None:
        n = 50
        r = np.linspace(120, 125, n)
        g = np.linspace(100, 105, n)
        b = np.linspace(80, 85, n)
        chrom = _chrom_signal(r, g, b)
        assert len(chrom) == n


class TestConfidenceInterval:
    def test_ci_bounds_contain_point_estimate(self) -> None:
        low, high, half = _compute_ci(78.0, prominence=0.6, n_samples=60, face_coverage=0.9, motion_score=0.1)
        assert low <= 78.0 <= high
        assert half >= 3.0

    def test_ci_widens_with_poor_prominence(self) -> None:
        _, _, narrow = _compute_ci(78.0, 0.8, 60, 0.9, 0.1)
        _, _, wide = _compute_ci(78.0, 0.2, 60, 0.9, 0.1)
        assert wide > narrow


class TestCompositeConfidence:
    def test_high_quality_scores_high(self) -> None:
        score = _composite_confidence(0.8, 0.95, 0.05, True)
        assert score >= 0.7

    def test_motion_penalizes_score(self) -> None:
        still = _composite_confidence(0.6, 0.9, 0.05, True)
        moving = _composite_confidence(0.6, 0.9, 0.5, True)
        assert still > moving


class TestMeasurementStatus:
    def test_unreliable_when_low_coverage(self) -> None:
        assert _measurement_status(0.8, 0.5, 5.0, True, True) == "unreliable"

    def test_reliable_when_high_confidence(self) -> None:
        assert _measurement_status(0.75, 0.9, 5.0, True, True) == "reliable"


class TestDetectRppgIntegration:
    def _synthetic_frames(self, n: int = 120) -> list[np.ndarray]:
        frames = []
        for i in range(n):
            frame = np.full((480, 640, 3), 180, dtype=np.uint8)
            # subtle brightness pulse ~1.2 Hz (~72 bpm)
            pulse = int(8 * np.sin(2 * np.pi * 1.2 * i / 30))
            cv2_color = np.clip(160 + pulse, 0, 255).astype(np.uint8)
            frame[:, :, 1] = cv2_color
            frames.append(frame)
        return frames

    @patch("rppg.rppg._extract_roi_series")
    @patch("rppg.rppg._decode_video")
    def test_detect_rppg_returns_ci_fields(self, mock_decode, mock_extract) -> None:
        n = 120
        t = np.arange(n, dtype=np.float64)
        pulse = 160 + 8 * np.sin(2 * np.pi * 1.2 * t / 30)
        mock_decode.return_value = (self._synthetic_frames(n), 30.0)
        mock_extract.return_value = (
            pulse + 5,
            pulse,
            pulse - 5,
            0.95,
            0.05,
            list(pulse),
        )

        result = detect_rppg("dGVzdA==")

        assert "heart_rate_bpm" in result
        assert "heart_rate_bpm_low" in result
        assert "heart_rate_bpm_high" in result
        assert "measurement_status" in result
        assert "quality_metrics" in result
        if result["heart_rate_bpm"] is not None:
            assert result["heart_rate_bpm_low"] <= result["heart_rate_bpm"] <= result["heart_rate_bpm_high"]

    @patch("rppg.rppg._extract_roi_series")
    @patch("rppg.rppg._decode_video")
    def test_unreliable_low_face_coverage(self, mock_decode, mock_extract) -> None:
        mock_decode.return_value = (self._synthetic_frames(30), 30.0)
        mock_extract.return_value = (
            np.array([120.0]),
            np.array([100.0]),
            np.array([80.0]),
            0.3,
            0.1,
            [120.0],
        )

        result = detect_rppg("dGVzdA==")
        assert result["measurement_status"] == "unreliable"
        assert result["heart_rate_bpm"] is None
