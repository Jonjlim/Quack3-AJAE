"""Tests for scene-intel REST endpoints (mocked analysis — no Gemini/MediaPipe required)."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from shared.schemas.telemetry import SceneIntelFallResponse, SceneIntelRppgResponse


class TestSceneIntelFallDetection:
    @patch("app.routers.scene_intel.run_fall_detection")
    def test_no_fall_returns_analysis_only(self, mock_run: MagicMock, client: TestClient) -> None:
        mock_run.return_value = {
            "fall_detected": False,
            "confidence": 0.1,
            "danger_level": "low",
            "coordinates": None,
            "frame_timestamp": None,
        }
        response = client.post(
            "/api/v1/scene-intel/fall-detection",
            files={"video": ("clip.mp4", b"fake-video-bytes", "video/mp4")},
        )
        assert response.status_code == 200
        parsed = SceneIntelFallResponse.model_validate(response.json())
        assert parsed.analysis.fall_detected is False
        assert parsed.alert is None
        assert parsed.broadcast is False

    @patch("app.routers.scene_intel.run_fall_detection")
    def test_fall_detected_fires_alert(self, mock_run: MagicMock, client: TestClient) -> None:
        mock_run.return_value = {
            "fall_detected": True,
            "confidence": 0.92,
            "danger_level": "high",
            "coordinates": {"x": 100, "y": 200},
            "frame_timestamp": 1.5,
        }
        response = client.post(
            "/api/v1/scene-intel/fall-detection",
            files={"video": ("fall.mp4", b"fake-video-bytes", "video/mp4")},
        )
        assert response.status_code == 200
        parsed = SceneIntelFallResponse.model_validate(response.json())
        assert parsed.analysis.fall_detected is True
        assert parsed.alert is not None
        assert parsed.alert.type.value == "CRITICAL_FALL"
        assert parsed.broadcast is True
        assert "100" in parsed.alert.message

    def test_rejects_non_video(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/scene-intel/fall-detection",
            files={"video": ("note.txt", b"hello", "text/plain")},
        )
        assert response.status_code == 415

    def test_rejects_empty_upload(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/scene-intel/fall-detection",
            files={"video": ("empty.mp4", b"", "video/mp4")},
        )
        assert response.status_code == 400


class TestSceneIntelRppg:
    @patch("app.routers.scene_intel.run_rppg_analysis")
    def test_rppg_applies_biometric(self, mock_run: MagicMock, client: TestClient) -> None:
        mock_run.return_value = {
            "heart_rate_bpm": 88.5,
            "confidence": 0.9,
            "signal_quality": "good",
            "error": None,
        }
        response = client.post(
            "/api/v1/scene-intel/rppg",
            data={"patient_id": "pat-002"},
            files={"video": ("face.mp4", b"fake-video-bytes", "video/mp4")},
        )
        assert response.status_code == 200
        parsed = SceneIntelRppgResponse.model_validate(response.json())
        assert parsed.analysis.heart_rate_bpm == 88.5
        assert parsed.biometric is not None
        assert parsed.biometric.patient_id == "pat-002"
        assert parsed.broadcast is True

    @patch("app.routers.scene_intel.run_rppg_analysis")
    def test_rppg_no_face_skips_biometric(self, mock_run: MagicMock, client: TestClient) -> None:
        mock_run.return_value = {
            "heart_rate_bpm": None,
            "confidence": 0.0,
            "signal_quality": "poor",
            "error": "Could not detect face in enough frames",
        }
        response = client.post(
            "/api/v1/scene-intel/rppg",
            data={"patient_id": "pat-002"},
            files={"video": ("dark.mp4", b"fake-video-bytes", "video/mp4")},
        )
        assert response.status_code == 200
        parsed = SceneIntelRppgResponse.model_validate(response.json())
        assert parsed.biometric is None
        assert parsed.broadcast is False

    def test_rppg_unknown_patient_404(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/scene-intel/rppg",
            data={"patient_id": "pat-missing"},
            files={"video": ("face.mp4", b"fake-video-bytes", "video/mp4")},
        )
        assert response.status_code == 404
