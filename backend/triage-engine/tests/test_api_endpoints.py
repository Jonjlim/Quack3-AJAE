"""Integration tests for all triage-engine REST and WebSocket endpoints."""

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter

from shared.schemas.telemetry import (
    AcuityLoad,
    AlertAckResponse,
    AlertType,
    DemoFallTriggerResponse,
    IntakeResponse,
    LiveKitTokenResponse,
    PatientRecord,
    QueueStatus,
    TelemetryEnvelope,
    TelemetryEventType,
)

INTAKE_BODY = {
    "display_name": "Sam T.",
    "chief_complaint": "Shortness of breath",
    "acuity_self_report": "URGENT",
}


class TestHealth:
    def test_health_returns_ok(self, client: TestClient) -> None:
        response = client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "ok"
        assert body["service"] == "triage-engine"


class TestIntake:
    def test_create_intake_returns_valid_response(self, client: TestClient) -> None:
        response = client.post("/api/v1/intake", json=INTAKE_BODY)
        assert response.status_code == 201

        parsed = IntakeResponse.model_validate(response.json())
        assert parsed.patient_id.startswith("pat-")
        assert parsed.queue_position >= 1
        assert parsed.estimated_wait_minutes >= 0

    def test_create_intake_rejects_empty_body(self, client: TestClient) -> None:
        response = client.post("/api/v1/intake", json={})
        assert response.status_code == 422

    def test_create_intake_adds_patient_to_grid(self, client: TestClient) -> None:
        before = len(client.get("/api/v1/patients").json())
        created = client.post("/api/v1/intake", json=INTAKE_BODY).json()
        patients = TypeAdapter(list[PatientRecord]).validate_python(
            client.get("/api/v1/patients").json()
        )
        assert len(patients) == before + 1
        assert any(p.patient_id == created["patient_id"] for p in patients)


class TestQueue:
    def test_get_queue_status_for_seed_patient(self, client: TestClient) -> None:
        response = client.get("/api/v1/queue/pat-001")
        assert response.status_code == 200

        parsed = QueueStatus.model_validate(response.json())
        assert parsed.patient_id == "pat-001"
        assert parsed.queue_position >= 1
        assert parsed.wait_minutes >= 0
        assert parsed.estimated_wait_minutes >= 0
        assert parsed.acuity_load.total_waiting >= 1

    def test_get_queue_status_unknown_patient_404(self, client: TestClient) -> None:
        response = client.get("/api/v1/queue/pat-does-not-exist")
        assert response.status_code == 404
        assert response.json()["detail"] == "Patient not found"

    def test_get_queue_after_intake(self, client: TestClient) -> None:
        created = IntakeResponse.model_validate(
            client.post("/api/v1/intake", json=INTAKE_BODY).json()
        )
        response = client.get(f"/api/v1/queue/{created.patient_id}")
        assert response.status_code == 200

        parsed = QueueStatus.model_validate(response.json())
        assert parsed.patient_id == created.patient_id
        assert parsed.queue_position == created.queue_position


class TestAcuityLoad:
    def test_get_acuity_load_valid_shape(self, client: TestClient) -> None:
        response = client.get("/api/v1/acuity-load")
        assert response.status_code == 200

        parsed = AcuityLoad.model_validate(response.json())
        assert parsed.active_traumas >= 0
        assert parsed.severe_count >= 0
        assert parsed.emergent_count >= 0
        assert parsed.total_waiting >= 1
        assert parsed.estimated_wait_minutes >= 0

    def test_acuity_load_updates_after_intake(self, client: TestClient) -> None:
        before = AcuityLoad.model_validate(client.get("/api/v1/acuity-load").json())
        client.post("/api/v1/intake", json=INTAKE_BODY)
        after = AcuityLoad.model_validate(client.get("/api/v1/acuity-load").json())
        assert after.total_waiting == before.total_waiting + 1


class TestPatients:
    def test_get_patients_returns_valid_list(self, client: TestClient) -> None:
        response = client.get("/api/v1/patients")
        assert response.status_code == 200

        patients = TypeAdapter(list[PatientRecord]).validate_python(response.json())
        assert len(patients) >= 2
        positions = [p.queue_position for p in patients]
        assert positions == sorted(positions)
        for patient in patients:
            assert patient.patient_id
            assert patient.display_name
            assert patient.acuity
            assert patient.status

    def test_patients_sorted_by_triage_priority(self, client: TestClient) -> None:
        patients = TypeAdapter(list[PatientRecord]).validate_python(
            client.get("/api/v1/patients").json()
        )
        # Seed data: pat-002 is EMERGENT/ESCALATED and should lead pat-001 (URGENT)
        assert patients[0].patient_id == "pat-002"
        assert patients[0].queue_position == 1


class TestAlerts:
    def test_demo_trigger_fall_creates_valid_alert(self, client: TestClient) -> None:
        response = client.post("/api/v1/demo/trigger-fall")
        assert response.status_code == 200

        parsed = DemoFallTriggerResponse.model_validate(response.json())
        assert parsed.broadcast is True
        assert parsed.alert.type == AlertType.CRITICAL_FALL
        assert parsed.alert.severity.value == "CRITICAL"
        assert parsed.alert.acknowledged is False
        assert parsed.alert.message

    def test_acknowledge_alert_success(self, client: TestClient) -> None:
        fall = DemoFallTriggerResponse.model_validate(
            client.post("/api/v1/demo/trigger-fall").json()
        )
        response = client.post(
            f"/api/v1/alerts/{fall.alert.alert_id}/ack",
            json={"nurse_id": "nurse-01", "notes": "Responded"},
        )
        assert response.status_code == 200

        parsed = AlertAckResponse.model_validate(response.json())
        assert parsed.alert_id == fall.alert.alert_id
        assert parsed.acknowledged is True

    def test_acknowledge_unknown_alert_404(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/alerts/alert-does-not-exist/ack",
            json={"nurse_id": "nurse-01"},
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Alert not found"

    def test_acknowledge_alert_rejects_missing_nurse_id(self, client: TestClient) -> None:
        fall = DemoFallTriggerResponse.model_validate(
            client.post("/api/v1/demo/trigger-fall").json()
        )
        response = client.post(f"/api/v1/alerts/{fall.alert.alert_id}/ack", json={})
        assert response.status_code == 422


class TestLiveKitToken:
    def test_livekit_token_patient_role(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/livekit/token",
            json={"room": "er-waiting-room", "identity": "pat-001", "role": "patient"},
        )
        assert response.status_code == 200

        parsed = LiveKitTokenResponse.model_validate(response.json())
        assert parsed.token
        assert parsed.url
        assert parsed.room == "er-waiting-room"
        assert parsed.identity == "pat-001"

    @pytest.mark.parametrize("role", ["nurse", "broad_camera", "patient"])
    def test_livekit_token_all_roles(self, client: TestClient, role: str) -> None:
        response = client.post(
            "/api/v1/livekit/token",
            json={"room": "er-waiting-room", "identity": f"id-{role}", "role": role},
        )
        assert response.status_code == 200
        LiveKitTokenResponse.model_validate(response.json())

    def test_livekit_token_rejects_invalid_role(self, client: TestClient) -> None:
        response = client.post(
            "/api/v1/livekit/token",
            json={"room": "er-waiting-room", "identity": "bad", "role": "admin"},
        )
        assert response.status_code == 422


class TestWebSockets:
    def test_nurse_ws_receives_patients_snapshot(self, client: TestClient) -> None:
        with client.websocket_connect("/ws/nurse") as ws:
            envelope = TelemetryEnvelope.model_validate(ws.receive_json())
            assert envelope.type == TelemetryEventType.PATIENTS_SNAPSHOT
            assert "patients" in envelope.payload
            patients = TypeAdapter(list[PatientRecord]).validate_python(
                envelope.payload["patients"]
            )
            assert len(patients) >= 2

    def test_patient_ws_receives_queue_update(self, client: TestClient) -> None:
        with client.websocket_connect("/ws/patient/pat-001") as ws:
            envelope = TelemetryEnvelope.model_validate(ws.receive_json())
            assert envelope.type == TelemetryEventType.QUEUE_UPDATE
            QueueStatus.model_validate(envelope.payload)

    def test_patient_ws_help_request_flow(self, client: TestClient) -> None:
        with client.websocket_connect("/ws/patient/pat-001") as ws:
            ws.receive_json()  # initial QUEUE_UPDATE
            ws.send_json(
                {
                    "version": "1.0",
                    "type": "ALERT",
                    "timestamp": "2026-05-30T18:22:00Z",
                    "payload": {
                        "patient_id": "pat-001",
                        "message": "Immediate help requested",
                    },
                }
            )
            messages = [ws.receive_json() for _ in range(3)]
            help_ack = next(m for m in messages if m.get("type") == "HELP_ACK")
            status = next(m for m in messages if m.get("status") == "received")

            assert help_ack["type"] == "HELP_ACK"
            assert help_ack["payload"]["patient_id"] == "pat-001"
            assert status["alert_id"].startswith("alert-help-")

    def test_patient_ws_camera_status_updates_nurse_grid(self, client: TestClient) -> None:
        created = client.post("/api/v1/intake", json=INTAKE_BODY).json()
        patient_id = created["patient_id"]

        with client.websocket_connect("/ws/nurse") as nurse_ws:
            nurse_ws.receive_json()  # initial snapshot

            with client.websocket_connect(f"/ws/patient/{patient_id}") as patient_ws:
                patient_ws.receive_json()  # initial QUEUE_UPDATE
                patient_ws.send_json(
                    {
                        "version": "1.0",
                        "type": "CAMERA_STATUS",
                        "timestamp": "2026-05-30T18:22:00Z",
                        "payload": {"patient_id": patient_id, "enabled": True},
                    }
                )
                messages = [patient_ws.receive_json() for _ in range(3)]
                status = next(m for m in messages if m.get("status") == "received")
                assert status["status"] == "received"

            update = nurse_ws.receive_json()
            assert update["type"] == "PATIENT_UPDATE"
            assert update["payload"]["patient_id"] == patient_id
            assert update["payload"]["camera_enabled"] is True
            assert update["payload"]["status"] == "STREAMING"

    def test_ai_ws_accepts_alert(self, client: TestClient) -> None:
        with client.websocket_connect("/ws/ai") as ws:
            ws.send_json(
                {
                    "version": "1.0",
                    "type": "ALERT",
                    "timestamp": "2026-05-30T18:20:00Z",
                    "payload": {
                        "alert_id": "alert-ws-test",
                        "type": "CRITICAL_FALL",
                        "severity": "CRITICAL",
                        "patient_id": None,
                        "message": "WS test fall",
                        "acknowledged": False,
                        "created_at": "2026-05-30T18:20:00Z",
                    },
                }
            )
            response = ws.receive_json()
            assert response["status"] == "received"

        # Alert should be ack-able via REST after WS ingress
        ack_response = client.post(
            "/api/v1/alerts/alert-ws-test/ack",
            json={"nurse_id": "nurse-01"},
        )
        assert ack_response.status_code == 200
        assert AlertAckResponse.model_validate(ack_response.json()).acknowledged is True

    def test_ai_ws_accepts_biometric(self, client: TestClient) -> None:
        with client.websocket_connect("/ws/ai") as ws:
            ws.send_json(
                {
                    "version": "1.0",
                    "type": "BIOMETRIC",
                    "timestamp": "2026-05-30T18:11:00Z",
                    "payload": {
                        "patient_id": "pat-002",
                        "heart_rate_bpm": 95.0,
                        "respiratory_rate_bpm": 18.0,
                        "confidence": 0.9,
                        "source": "rppg",
                        "recorded_at": "2026-05-30T18:11:00Z",
                    },
                }
            )
            response = ws.receive_json()
            assert response["status"] == "received"

        patients = TypeAdapter(list[PatientRecord]).validate_python(
            client.get("/api/v1/patients").json()
        )
        pat_002 = next(p for p in patients if p.patient_id == "pat-002")
        assert pat_002.last_biometric is not None
        assert pat_002.last_biometric.heart_rate_bpm == 95.0

    def test_ai_ws_rejects_invalid_payload(self, client: TestClient) -> None:
        with client.websocket_connect("/ws/ai") as ws:
            ws.send_text("not-json")
            response = ws.receive_json()
            assert response["status"] == "error"
