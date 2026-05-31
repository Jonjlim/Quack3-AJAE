# ER-OVERWATCH

> **Zero-install, real-time emergency room telemetry and triage optimization — built in 36 hours.**

ER-OVERWATCH bridges the critical data gap between an overcrowded waiting room and overwhelmed medical staff. Patients get transparent, privacy-safe queue visibility. Nurses get a live command dashboard with AI-assisted triage, remote vitals monitoring, and automatic fall detection — all without wiring a single new device.

---

## The Problem

Emergency rooms are drowning. The average US ER wait time exceeds 2.5 hours, and nurses spend enormous cognitive bandwidth on manual triage updates, room monitoring, and patient status tracking — time stolen from actual care. Patients sit in the dark: no information, rising anxiety, and no way to signal deteriorating symptoms.

**The gap:** There is no lightweight, real-time bridge between the patient waiting area and the triage team that works on commodity hardware without proprietary sensors.

---

## Our Solution

ER-OVERWATCH turns any smartphone and a room webcam into a clinical monitoring system:

- **Patients** sign in on a PWA, join a transparent queue showing *Anonymized Acuity Load* (aggregate trauma burden — not other patients' names), and optionally opt into passive heart-rate monitoring via their front-facing camera.
- **Nurses** get a live command dashboard: patient grid, real-time biometrics, AI-assisted intake notes, fall alerts, and a LiveKit video feed — all in a browser tab.
- **AI triage:** Gemini generates clinical observation notes from chief complaint text, helping nurses prioritize faster.
- **Fall detection:** Runs entirely in the browser on the room's wide-angle camera stream, with no video upload. Falls trigger instant CRITICAL alerts on the nurse dashboard.
- **HIPAA pivot:** Patients only see aggregate acuity load — never individual wait times or other patients' identities.

---

## Feature Highlights

| Feature | Description |
|---------|-------------|
| Real-time queue | Live WebSocket-driven patient queue with acuity-weighted ordering |
| rPPG vitals | Server-side heart rate from 8s face clips — no wearables required |
| Browser fall detection | Motion heuristics on MediaStream — zero video upload, zero latency |
| AI intake assistant | Gemini generates clinical observation notes from chief complaint |
| Acuity Load indicator | Anonymous aggregate trauma score shown to patients |
| LiveKit video | WebRTC room feed in the nurse dashboard, per-patient modal |
| Firebase Auth | Google (nurses) + Anonymous (patients) — optional, zero-config default |
| Mock mode | Full UI demo without any running backend |
| Demo trigger | `POST /api/v1/demo/trigger-fall` fires a canned alert for judging fallback |

---

## Architecture

```text
┌─────────────────────┐     REST / WebSocket   ┌──────────────────────┐
│  patient-client     │◄──────────────────────►│  triage-engine       │
│  (Next.js 14 PWA)   │                         │  (FastAPI :8000)     │
│                     │                         │                      │
│  · queue + sign-in  │   POST /api/v1/rppg     │  · patient state     │
│  · rPPG clip upload │────────────────────────►│  · acuity engine     │
│  · acuity load view │                         │  · alert routing     │
└─────────────────────┘                         └──────────▲───────────┘
                                                            │ WebSocket
┌─────────────────────┐     REST / WebSocket               │
│  nurse-command      │◄───────────────────────────────────┘
│  (React 19 + Vite)  │
│                     │   POST /alerts/fall-report
│  · triage grid      │────────────────────────► (JSON only, no video)
│  · fall detection   │
│    (in browser)     │
│  · LiveKit feeds    │◄──────────────────────► LiveKit Cloud (WebRTC)
└─────────────────────┘
             │
             ▼
    backend/rppg (OpenCV + MediaPipe)
    CHROM chrominance + FFT → heart rate BPM + confidence
```

### Video Processing Split

| Concern | Where it runs | Latency |
|---------|---------------|---------|
| Fall detection | Browser (nurse-command, MediaStream) | < 250 ms |
| rPPG heart rate | Server (OpenCV + MediaPipe Face Mesh) | ~1–2 s per clip |
| Room / patient video | LiveKit WebRTC | sub-second |

---

## Tech Stack

### Frontend
| | |
|-|-|
| **patient-client** | Next.js 14, React 18, Tailwind CSS v4, LiveKit React SDK |
| **nurse-command** | React 19, Vite, Tailwind CSS v4, LiveKit React SDK |

### Backend
| | |
|-|-|
| **triage-engine** | FastAPI, Python 3.11, Pydantic v2, WebSockets, uvicorn |
| **rppg** | OpenCV, MediaPipe Face Mesh, NumPy, scipy (Butterworth filter + FFT) |

### AI & Services
| | |
|-|-|
| **Gemini** | AI intake clinical notes + triage reasoning |
| **LiveKit Cloud** | WebRTC room management, SFU, token auth |
| **Firebase** | Google Auth (nurses) + Anonymous sign-in (patients) |

### Algorithm: CHROM rPPG
The rPPG pipeline uses the **CHROM chrominance method** on the forehead ROI (10 MediaPipe Face Mesh landmarks), fused with autocorrelation and FFT peak detection. A Butterworth bandpass filter (0.7–4 Hz, 42–240 BPM) is applied before frequency analysis. Each reading includes a 95% confidence interval; readings below threshold confidence are flagged as unreliable and suppressed from the nurse grid.

---

## Project Structure

```text
Quack3-AJAE/
├── frontend/
│   ├── patient-client/    # Patient PWA — sign-in, queue, camera + rPPG clip upload
│   └── nurse-command/     # Nurse dashboard — check-in, fall detection, LiveKit feed
├── backend/
│   ├── triage-engine/     # FastAPI REST + WebSockets + LiveKit token service
│   └── rppg/              # Server-side heart rate from face video (OpenCV / MediaPipe)
├── shared/                # Pydantic schemas (Python) + TypeScript mirrors
└── docs/
    ├── ARCHITECTURE.md
    ├── API_endpoints.md
    ├── DEMO.md
    └── FIREBASE_AUTH.md
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- [LiveKit Cloud](https://cloud.livekit.io) project (free tier works)
- Gemini API key ([Google AI Studio](https://aistudio.google.com))

### 1. Environment Setup

```bash
git clone <repo>
cd Quack3-AJAE
cp .env.example .env
```

Edit `.env` and fill in:

```env
LIVEKIT_API_KEY=...          # from cloud.livekit.io project settings
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://your-project.livekit.cloud

GEMINI_API_KEY=...           # from aistudio.google.com

# Firebase is optional — leave REQUIRE_FIREBASE_AUTH=false to skip
REQUIRE_FIREBASE_AUTH=false
```

### 2. Triage Engine (Backend)

```bash
cd backend/triage-engine
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
./run.sh
# → http://localhost:8000
# → Swagger UI: http://localhost:8000/docs
```

### 3. Patient PWA

```bash
cd frontend/patient-client
npm install
npm run dev
# → https://localhost:3000
```

Sign in with a **patient ID** generated during nurse check-in.

### 4. Nurse Command Dashboard

```bash
cd frontend/nurse-command
npm install
npm run dev
# → http://localhost:5173
```

- Main dashboard: `http://localhost:5173`
- Room camera + fall detection: `http://localhost:5173/camera`

### 5. (Optional) rPPG Unit Tests

```bash
cd backend/rppg
pip install -r requirements.txt
pytest test_rppg.py -v
```

### One-command start (Windows)

```bat
start-all.bat
```

---

## Key Flows

### Patient Check-In & Queue
1. Nurse opens `http://localhost:5173`, enters patient name + chief complaint.
2. Triage engine calls Gemini to generate a clinical observation note.
3. Patient receives a unique `patient_id` and joins the queue on their phone at `https://localhost:3000`.
4. Queue positions are recomputed live using acuity-weighted ordering; all connected clients receive a WebSocket push.

### Remote Vitals (rPPG)
1. Patient opts into camera on their queue page.
2. `useRppgSampler` captures ~8-second clips and POSTs them (base64) to `POST /api/v1/rppg`.
3. `backend/rppg` runs CHROM + FFT on the forehead ROI and returns `{ bpm, confidence, ci_lower, ci_upper }`.
4. Triage engine updates `PatientRecord.last_biometric`; if BPM is critical, a `BIOMETRIC_DROP` alert fires and appears instantly on the nurse grid.

### Fall Detection (Browser)
1. A room device opens `/camera` and publishes its stream to LiveKit.
2. `browserFallDetector.ts` samples frames ~4 Hz from the `MediaStream`.
3. Motion heuristics detect a rapid drop event in the lower frame band.
4. On confidence ≥ 0.6 with `medium`/`high` danger, a `POST /api/v1/alerts/fall-report` fires (JSON only — no video uploaded).
5. Triage engine emits `CRITICAL_FALL` on `ws://.../ws/nurse`; the nurse grid flashes within milliseconds.

### AI Intake Notes
- Chief complaint text → Gemini → structured clinical observation note.
- Gemini is **advisory only**: acuity is always set by the human nurse, never overridden by AI.

---

## API Reference (Selected Endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/intake` | Check in a new patient (nurse-only) |
| `GET` | `/api/v1/patients` | List all patients with queue positions |
| `POST` | `/api/v1/rppg` | Submit face video clip for heart rate analysis |
| `POST` | `/api/v1/alerts/fall-report` | Report a browser-detected fall event |
| `GET` | `/api/v1/queue/{patient_id}` | Get queue status for a single patient |
| `WS` | `/ws/nurse` | Nurse WebSocket — patient snapshots + alerts |
| `WS` | `/ws/patient/{patient_id}` | Patient WebSocket — personal queue updates |
| `POST` | `/api/v1/livekit/token` | Issue a LiveKit room token |
| `POST` | `/api/v1/demo/trigger-fall` | Fire a canned fall alert (demo fallback) |

Full contract: [`docs/API_endpoints.md`](docs/API_endpoints.md)

---

## Mock / Demo Mode

No backend? No problem.

```env
# patient-client
NEXT_PUBLIC_USE_MOCK=true

# nurse-command
VITE_USE_MOCK=true
```

Both frontends run fully with seeded mock data. For a live fall alert without camera hardware:

```bash
curl -X POST http://localhost:8000/api/v1/demo/trigger-fall
```

Full demo script: [`docs/DEMO.md`](docs/DEMO.md)

---

## Firebase Auth (Optional)

By default, the stack runs without any authentication. To enable:

1. Create a Firebase project, enable **Google** and **Anonymous** sign-in providers.
2. Download a service account JSON → place it at `./firebase-service-account.json`.
3. Set `REQUIRE_FIREBASE_AUTH=true` in `.env` along with the Firebase project variables.

See [`docs/FIREBASE_AUTH.md`](docs/FIREBASE_AUTH.md) for step-by-step setup.

---

## Privacy & HIPAA Considerations

- **Patients never see other patients.** The queue page shows only an aggregate *Acuity Load* score — no names, IDs, or individual wait times of other patients.
- **Fall detection sends no video.** Only a small JSON payload (confidence score, severity) is transmitted to the backend. Raw video stays in the browser.
- **rPPG clips are ephemeral.** Video clips are written to a temp file, analyzed, and immediately deleted — never persisted.
- **Firebase Anonymous sign-in** ensures patient sessions are not linked to any personal identity unless the patient explicitly signs in.

---

## What We Learned

- **rPPG on mobile is hard.** Lighting variation and user movement cause enormous noise. We implemented EMA smoothing, a multi-sample HR buffer, confidence gating, and CHROM fusion to make readings production-viable.
- **Browser fall detection is surprisingly effective.** Pure motion heuristics on a room stream with no ML model runs at 60 fps with negligible CPU on any 2020+ laptop — and fires alerts in under 250 ms.
- **WebSockets beat polling for ER triage.** The nurse dashboard needs instant visibility; a 1-second polling loop creates perceptible lag that erodes trust. Full-duplex WS removes that entirely.
- **Gemini is advisory, not authoritative.** We deliberately wired Gemini to provide *analysis notes*, not acuity decisions — a nurse always owns the final call.

---

## Roadmap / Future Work

- [ ] Persistent database (PostgreSQL + Redis) to survive server restarts
- [ ] Escalation workflow: nurse acknowledges alerts, audit trail
- [ ] Multi-room support: triage-engine routes patients across rooms
- [ ] On-device rPPG inference (TensorFlow.js) to reduce server load
- [ ] Integration with EHR systems (HL7 FHIR) for discharge records
- [ ] Noise-robust fall detection using MediaPipe Pose in a Worker thread
- [ ] Admin analytics: throughput, average acuity, alert frequency

---

## Team — Quack3 AJAE

Built at **[Hackathon Name]** — 36 hours, one repo, zero sleep.

---

*Architecture deep-dive: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)*  
*Full API contract: [`docs/API_endpoints.md`](docs/API_endpoints.md)*  
*Demo playbook: [`docs/DEMO.md`](docs/DEMO.md)*
