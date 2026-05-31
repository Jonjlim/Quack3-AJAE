"""Tests for rPPG REST endpoint (mocked analysis — no MediaPipe required)."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from shared.schemas.telemetry import SceneIntelRppgResponse


class TestRppgEndpoint:
    @patch("app.routers.rppg.run_rppg_analysis")
    def test_rppg_returns_biometric(self, mock_run: MagicMock, client: TestClient) -> None:
        mock_run.return_value = {
            "heart_rate_bpm": 88.5,
            "heart_rate_bpm_low": 82.0,
            "heart_rate_bpm_high": 95.0,
            "confidence": 0.9,
            "signal_quality": "good",
            "measurement_status": "reliable",
            "quality_metrics": {
                "face_coverage": 0.92,
                "motion_score": 0.08,
                "peak_prominence": 0.75,
                "chrom_fft_agreement_bpm": 2.0,
            },
            "error": None,
        }
        response = client.post(
            "/api/v1/rppg",
            data={"patient_id": "pat-002"},
            files={"video": ("clip.webm", b"fake-video-bytes", "video/webm")},
        )
        assert response.status_code == 200
        parsed = SceneIntelRppgResponse.model_validate(response.json())
        assert parsed.biometric is not None
        assert parsed.biometric.heart_rate_bpm == 88.5

    def test_rppg_patient_not_found(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/rppg",
            data={"patient_id": "pat-missing"},
            files={"video": ("clip.webm", b"fake", "video/webm")},
        )
        assert response.status_code == 404

    def test_rppg_rejects_empty_video(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/rppg",
            data={"patient_id": "pat-001"},
            files={"video": ("clip.webm", b"", "video/webm")},
        )
        assert response.status_code == 400
