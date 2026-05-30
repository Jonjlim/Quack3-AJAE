# ER-OVERWATCH API Contract

Base URL: `http://localhost:8000`

All timestamps are ISO 8601 UTC. WebSocket payloads use the `TelemetryEnvelope` wrapper defined in `shared/schemas/telemetry.py`.

---

## REST Endpoints

### POST `/api/v1/intake`

Register a new patient after QR scan / digital intake.

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

**Response `200`:**

```json
{
  "patient_id": "pat-001",
  "queue_position": 4,
  "wait_minutes": 12,
  "estimated_wait_minutes": 45,
  "status": "WAITING",
  "acuity_load": {
    "active_traumas": 2,
    "severe_count": 1,
    "emergent_count": 3,
    "total_waiting": 14,
    "estimated_wait_minutes": 45,
    "updated_at": "2026-05-30T18:12:00Z"
  }
}
```

---

### GET `/api/v1/acuity-load`

Anonymized ER burden for the patient PWA (HIPAA-safe aggregate).

**Response `200`:**

```json
{
  "active_traumas": 2,
  "severe_count": 1,
  "emergent_count": 3,
  "total_waiting": 14,
  "estimated_wait_minutes": 45,
  "updated_at": "2026-05-30T18:12:00Z"
}
```

---

### GET `/api/v1/patients`

Full patient grid for the nurse dashboard.

**Response `200`:**

```json
[
  {
    "patient_id": "pat-002",
    "display_name": "Jordan K.",
    "queue_position": 1,
    "acuity": "EMERGENT",
    "status": "ESCALATED",
    "wait_minutes": 28,
    "chief_complaint": "Severe abdominal pain",
    "camera_enabled": true,
    "last_biometric": {
      "patient_id": "pat-002",
      "heart_rate_bpm": 112.0,
      "respiratory_rate_bpm": 22.0,
      "confidence": 0.87,
      "source": "rppg",
      "recorded_at": "2026-05-30T18:11:00Z"
    },
    "created_at": "2026-05-30T17:44:00Z"
  },
  {
    "patient_id": "pat-001",
    "display_name": "Alex M.",
    "queue_position": 4,
    "acuity": "URGENT",
    "status": "WAITING",
    "wait_minutes": 12,
    "chief_complaint": "Chest pain, difficulty breathing",
    "camera_enabled": false,
    "last_biometric": null,
    "created_at": "2026-05-30T18:00:00Z"
  }
]
```

---

### POST `/api/v1/alerts/{alert_id}/ack`

Dismiss a sticky alert after nurse triage.

**Request:**

```json
{
  "nurse_id": "nurse-01",
  "notes": "Responded to waiting room sector B"
}
```

**Response `200`:**

```json
{
  "alert_id": "alert-001",
  "acknowledged": true,
  "acknowledged_at": "2026-05-30T18:15:00Z"
}
```

---

### POST `/api/v1/livekit/token`

Generate a LiveKit access token.

**Request:**

```json
{
  "room": "er-waiting-room",
  "identity": "pat-001",
  "role": "patient"
}
```

Roles: `patient`, `nurse`, `broad_camera`

**Response `200`:**

```json
{
  "token": "<jwt>",
  "url": "ws://localhost:7880",
  "room": "er-waiting-room",
  "identity": "pat-001"
}
```

---

### POST `/api/v1/demo/trigger-fall`

Demo fallback — fires a pre-baked `CRITICAL_FALL` alert (no network/CV required).

**Response `200`:**

```json
{
  "alert": {
    "alert_id": "alert-demo-fall",
    "type": "CRITICAL_FALL",
    "severity": "CRITICAL",
    "patient_id": null,
    "message": "Fall detected in waiting room sector B",
    "acknowledged": false,
    "created_at": "2026-05-30T18:20:00Z"
  },
  "broadcast": true
}
```

---

## WebSocket Endpoints

All messages use `TelemetryEnvelope`:

```json
{
  "version": "1.0",
  "type": "ALERT",
  "timestamp": "2026-05-30T18:20:00Z",
  "payload": { }
}
```

### `ws://localhost:8000/ws/nurse`

Nurse dashboard feed. Server pushes:

| `type` | `payload` shape |
|--------|-----------------|
| `PATIENTS_SNAPSHOT` | `{ "patients": PatientRecord[] }` |
| `PATIENT_UPDATE` | `PatientRecord` |
| `ALERT` | `AlertEvent` |
| `BIOMETRIC` | `BiometricReading` |

**Example incoming alert:**

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

Patient queue updates. Server pushes:

| `type` | `payload` shape |
|--------|-----------------|
| `QUEUE_UPDATE` | `QueueStatus` |
| `HELP_ACK` | `{ "patient_id": string, "message": string }` |

**Client may send help request:**

```json
{
  "version": "1.0",
  "type": "ALERT",
  "timestamp": "2026-05-30T18:22:00Z",
  "payload": {
    "patient_id": "pat-001",
    "message": "Immediate help requested"
  }
}
```

---

### `ws://localhost:8000/ws/ai`

Scene-intel → triage-engine ingress. Client sends:

| `type` | `payload` shape |
|--------|-----------------|
| `ALERT` | `AlertEvent` |
| `BIOMETRIC` | `BiometricReading` |

Server acknowledges with `{ "status": "received" }`.

---

## Mock-First Integration

Frontends should set env flags to use local mocks until backend is live:

- Patient client: `NEXT_PUBLIC_USE_MOCK=true`
- Nurse command: `VITE_USE_MOCK=true`

Mock data must match the JSON examples in this document exactly.
