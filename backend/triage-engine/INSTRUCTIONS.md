# Architect 3 — Triage Engine Playbook

You own `backend/triage-engine/`. This is the central nervous system: REST API, WebSockets, triage sorting, and LiveKit tokens.

## Setup (do this first)

```bash
# From repo root
cp .env.example .env
# Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL in .env (LiveKit Cloud)

cd backend/triage-engine
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
./run.sh                      # http://localhost:8000
```

Verify: `curl http://localhost:8000/health`

Interactive API docs: http://localhost:8000/docs

---

## What's implemented

| Feature | File(s) | Status |
|---------|---------|--------|
| Patient intake | `routers/intake.py` | Live — adds patient, re-sorts queue, broadcasts to nurses |
| Queue / acuity REST | `routers/queue.py` | Live |
| LiveKit tokens | `routers/livekit_tokens.py` | Live — needs LiveKit Cloud credentials in `.env` |
| Triage sort algorithm | `services/triage.py` | Live — acuity-weighted, escalation boost |
| Live state | `services/state.py` | Live — in-memory, recomputes on every mutation |
| WebSocket hub | `ws/manager.py`, `ws/nurse.py` | Live — nurse, patient, AI channels |
| Event broadcasts | `services/events.py` | Live — snapshots, alerts, biometrics, queue updates |
| Wait time ticker | `ws/nurse.py` + `main.py` lifespan | Live — refreshes every 30s |
| Demo fall trigger | `routers/queue.py` | Live — for judging fallback |

---

## Architecture

```text
REST routers ──> StateService ──> triage.py (sort / estimate)
                      │
                      v
                 EventBus ──> ConnectionManager ──> WebSocket clients
                      ^
                      │
              /ws/ai (Architect 4)
```

**State flow on intake:**
1. `POST /api/v1/intake` creates a `PatientRecord`
2. `StateService.add_patient()` re-sorts queue and recomputes acuity load
3. `EventBus` pushes `PATIENTS_SNAPSHOT` + `PATIENT_UPDATE` to nurses
4. Connected patient sockets receive `QUEUE_UPDATE`

**State flow on AI alert (Architect 4):**
1. scene-intel sends `TelemetryEnvelope` to `ws://localhost:8000/ws/ai`
2. `CRITICAL_FALL` → stored + broadcast `ALERT` to nurses + patient escalated if `patient_id` set
3. `BIOMETRIC` → updates patient vitals; critical drop auto-fires `BIOMETRIC_DROP` alert

---

## Your next tasks (priority order)

### Hour 1–2: Wire frontends to live backend

Tell Architect 1 & 2 to flip mock mode off:

```env
# frontend/patient-client/.env.local
NEXT_PUBLIC_USE_MOCK=false
NEXT_PUBLIC_API_URL=http://localhost:8000

# frontend/nurse-command/.env
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:8000
```

Test end-to-end:
```bash
# Terminal 1 — backend
./run.sh

# Terminal 2 — test intake
curl -X POST http://localhost:8000/api/v1/intake \
  -H "Content-Type: application/json" \
  -d '{"display_name":"Test P","chief_complaint":"Headache","acuity_self_report":"URGENT"}'

# Terminal 3 — demo fall (nurse dash should show sticky alert)
curl -X POST http://localhost:8000/api/v1/demo/trigger-fall
```

### Hour 2–3: Triage algorithm tuning

Edit `services/triage.py`:
- Adjust `ACUITY_MINUTES` to match your demo narrative
- Tune `is_biometric_critical()` thresholds for Architect 4's rPPG output
- Add chief-complaint keyword boost (e.g. "chest pain" → bump acuity)

### Hour 3–4: Redis persistence (optional but impressive)

If you have time, add Redis snapshot in `services/state.py`:
- Serialize `patients` + `alerts` to Redis on every mutation
- Reload on startup so restarts don't wipe demo data

### Hour 4+: PostgreSQL

Add SQLAlchemy models for patient history / alert audit log. Not required for demo — in-memory is fine for hackathon.

---

## WebSocket testing with wscat

```bash
npm install -g wscat

# Nurse feed
wscat -c ws://localhost:8000/ws/nurse

# Patient feed
wscat -c ws://localhost:8000/ws/patient/pat-001

# Simulate AI alert
wscat -c ws://localhost:8000/ws/ai
> {"version":"1.0","type":"ALERT","timestamp":"2026-05-30T18:20:00Z","payload":{"alert_id":"alert-test","type":"CRITICAL_FALL","severity":"CRITICAL","patient_id":null,"message":"Test fall","acknowledged":false,"created_at":"2026-05-30T18:20:00Z"}}
```

---

## Files you own — do NOT edit outside this folder

```
backend/triage-engine/
├── app/
│   ├── main.py              # FastAPI entry + background ticker
│   ├── config.py            # env vars
│   ├── routers/             # REST endpoints
│   ├── ws/                  # WebSocket endpoints
│   └── services/
│       ├── state.py         # ← most of your logic lives here
│       ├── triage.py        # ← sorting algorithm
│       └── events.py        # ← broadcast helpers
├── run.sh
└── requirements.txt
```

Schema changes go in `shared/schemas/telemetry.py` — notify Architects 1, 2, 4 when you change it.

---

## Demo checklist

- [ ] `./run.sh` running, `/health` returns ok
- [ ] Nurse dash connected (`VITE_USE_MOCK=false`) shows patient grid
- [ ] Patient intake creates new row on nurse grid
- [ ] `POST /api/v1/demo/trigger-fall` shows sticky alert
- [ ] Help button on patient PWA fires alert on nurse dash
- [ ] LiveKit token endpoint returns JWT (LiveKit Cloud credentials in `.env`)

See [`docs/DEMO.md`](../../docs/DEMO.md) for the full judging playbook.
