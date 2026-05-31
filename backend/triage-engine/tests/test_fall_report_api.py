"""Tests for browser fall-report endpoint."""

from fastapi.testclient import TestClient

from shared.schemas.telemetry import FallReportResponse


class TestFallReport:
    def test_high_confidence_fall_broadcasts_alert(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/alerts/fall-report",
            json={
                "confidence": 0.91,
                "danger_level": "high",
                "coordinates": {"x": 320, "y": 480},
                "source": "browser",
            },
        )
        assert response.status_code == 200
        parsed = FallReportResponse.model_validate(response.json())
        assert parsed.broadcast is True
        assert parsed.alert.type == "CRITICAL_FALL"

    def test_low_confidence_rejected(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/alerts/fall-report",
            json={"confidence": 0.2, "danger_level": "low", "source": "browser"},
        )
        assert response.status_code == 422
