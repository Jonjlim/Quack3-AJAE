# ER-OVERWATCH API Contract

Base URL: `http://localhost:8000`

All timestamps are ISO 8601 UTC. WebSocket payloads use the `TelemetryEnvelope` wrapper defined in `shared/schemas/telemetry.py`.

---

## REST Endpoints

### POST `/api/v1/intake`

Register a new patient (nurse check-in only — patient PWA uses sign-in, not intake).

**Request:**

```json
{
  "display_name": "Alex M.",
  "chief_complaint": "Chest pain, difficulty breathing",
  "acuity_self_report": "URGENT"
}
```

**Response `201`:**

```json
{
  "patient_id": "pat-001",
  "queue_position": 4,
  "estimated_wait_minutes": 45,
  "created_at": "2026-05-30T18:00:00Z"
}
```

---

### GET `/api/v1/queue/{patient_id}`

Individual queue status for the patient PWA.

**Response `200`:** `QueueStatus` (see shared schema).

**Response `404`:** Patient ID not found.

---

### GET `/api/v1/acuity-load`

Anonymized ER burden for the patient PWA (HIPAA-safe aggregate).

---

### GET `/api/v1/patients`

Full patient grid for the nurse dashboard.

---

### POST `/api/v1/alerts/{alert_id}/ack`

Dismiss a sticky alert after nurse triage.

---

### POST `/api/v1/alerts/fall-report`

**Browser fall detection** — nurse dashboard detects a fall locally and reports metadata (no video upload).

**Request:**

```json
{
  "confidence": 0.91,
  "danger_level": "high",
  "coordinates": { "x": 320, "y": 480 },
  "frame_timestamp": 12.4,
  "source": "browser",
  "patient_id": null,
  "message": null
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `confidence` | yes | 0.0–1.0; must be ≥ 0.6 to accept |
| `danger_level` | yes | `medium` or `high` to accept (`low` → `422`) |
| `coordinates` | no | Pixel coords in analyzed frame |
| `frame_timestamp` | no | Seconds into local stream |
| `source` | no | Always `"browser"` |
| `patient_id` | no | Optional link to a patient record |
| `message` | no | Override default alert text |

**Response `200`:**

```json
{
  "accepted": true,
  "broadcast": true,
  "alert": {
    "alert_id": "alert-fall-1717099200",
    "type": "CRITICAL_FALL",
    "severity": "CRITICAL",
    "patient_id": null,
    "message": "Fall detected (confidence 91%, danger high) at coordinates (320, 480)",
    "acknowledged": false,
    "created_at": "2026-05-30T18:20:00Z"
  }
}
```

**Response `422`:** Below confidence/danger threshold.

---

### POST `/api/v1/demo/trigger-fall`

Demo fallback — fires a pre-baked `CRITICAL_FALL` alert (no camera required).

---

### POST `/api/v1/rppg`

Server-side rPPG heart-rate analysis from a patient video clip (`backend/rppg`).

**Request:** `multipart/form-data`

- `patient_id` (string, required)
- `video` (video file, required)

**Response `200`:** `SceneIntelRppgResponse` — see shared schema for `analysis`, `biometric`, `alert`, `broadcast`.

**Note:** `biometric` is only populated when measurement is reliable and `confidence >= 0.5`.

---

### POST `/api/v1/livekit/token`

Generate a LiveKit access token.

**Roles:** `patient`, `nurse`, `broad_camera`

---

### POST `/api/v1/patients/{patient_id}/camera`

REST camera opt-in before rPPG sampling.

---

## Removed endpoints

| Former path | Replacement |
|-------------|-------------|
| `POST /api/v1/scene-intel/fall-detection` | Browser detection + `POST /api/v1/alerts/fall-report` |
| `POST /api/v1/scene-intel/rppg` | `POST /api/v1/rppg` |

---

## WebSocket Endpoints

All messages use `TelemetryEnvelope`.

### `ws://localhost:8000/ws/nurse`

Nurse dashboard feed. Server pushes:

| `type` | `payload` shape |
|--------|-----------------|
| `PATIENTS_SNAPSHOT` | `{ "patients": PatientRecord[] }` |
| `PATIENT_UPDATE` | `PatientRecord` |
| `ALERT` | `AlertEvent` |
| `BIOMETRIC` | `BiometricReading` |

**Example `CRITICAL_FALL` alert (from browser fall-report or demo trigger):**

```json
{
  "version": "1.0",
  "type": "ALERT",
  "timestamp": "2026-05-30T18:20:00Z",
  "payload": {
    "alert_id": "alert-001",
    "type": "CRITICAL_FALL",
    "severity": "CRITICAL",
    "patient_id": null,
    "message": "Fall detected in waiting room sector B",
    "acknowledged": false,
    "created_at": "2026-05-30T18:20:00Z"
  }
}
```

---

### `ws://localhost:8000/ws/patient/{patient_id}`

Patient queue updates (`QUEUE_UPDATE`, `HELP_ACK`). Client may send help requests as `ALERT` envelopes.

---

### `ws://localhost:8000/ws/ai`

Optional ingress for external agents to push `ALERT` / `BIOMETRIC` envelopes. **Fall detection does not use this path** — it uses `POST /api/v1/alerts/fall-report`.

---

## Mock-First Integration

- Patient client: `NEXT_PUBLIC_USE_MOCK=true`
- Nurse command: `VITE_USE_MOCK=true`

Mock data must match the JSON examples in this document and `shared/types/telemetry.ts`.
