# ER-OVERWATCH

Zero-install, real-time emergency room telemetry and triage optimization platform. Bridges the data gap between an overcrowded ER waiting room and overwhelmed medical staff.

**HIPAA pivot:** Patients see an **Anonymized Acuity Load** (aggregate trauma burden), not individual wait lines or other patients' names.

## Project Structure

```text
Quack3-AJAE/
├── frontend/
│   ├── patient-client/    # Patient sign-in, queue, camera + rPPG clip upload
│   └── nurse-command/     # Nurse dashboard, check-in, browser fall detection, LiveKit
├── backend/
│   ├── triage-engine/     # FastAPI REST + WebSockets + LiveKit tokens
│   └── rppg/              # Server-side heart rate from face video (OpenCV / MediaPipe)
├── shared/                # Pydantic schemas + TypeScript types
└── docs/                  # API contract, architecture, demo playbook
```

| Folder | Role | Stack |
|--------|------|-------|
| [`frontend/patient-client/`](frontend/patient-client/) | Patient queue & vitals | Next.js 14, Tailwind 4, LiveKit |
| [`frontend/nurse-command/`](frontend/nurse-command/) | Nurse ops & fall detection | React 19, Vite, Tailwind 4, LiveKit |
| [`backend/triage-engine/`](backend/triage-engine/) | API + real-time state | FastAPI, Python 3.11, Pydantic v2 |
| [`backend/rppg/`](backend/rppg/) | Remote photoplethysmography | OpenCV, MediaPipe, scipy |
| [`shared/`](shared/) | Contracts | Pydantic + TypeScript mirrors |

**Legacy:** [`backend/scene-intel/`](backend/scene-intel/) — deprecated (old Gemini fall path). Use `backend/rppg` and browser fall detection instead.

Architecture overview: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)  
API contract: [`docs/API_endpoints.md`](docs/API_endpoints.md)  
Demo playbook: [`docs/DEMO.md`](docs/DEMO.md)

## Quick Start

### 1. Environment

```bash
cp .env.example .env
# Fill in LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL from LiveKit Cloud
```

### 2. Triage Engine

```bash
cd backend/triage-engine
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt   # includes backend/rppg dependencies
./run.sh
```

Or: `PYTHONPATH=<repo-root> uvicorn app.main:app --reload --port 8000`

### 3. Patient PWA

```bash
cd frontend/patient-client
npm install
npm run dev
```

Open https://localhost:3000 — sign in with a **patient ID** from nurse check-in.

### 4. Nurse Command

```bash
cd frontend/nurse-command
npm install
npm run dev
```

Open http://localhost:5173 — check in patients and connect the wide-angle LiveKit feed.

Room camera + fall detection: http://localhost:5173/camera

### 5. rPPG (optional local test)

```bash
cd backend/rppg
pip install -r requirements.txt
pytest test_rppg.py
```

## Video processing model

| Feature | Runs where | API |
|---------|------------|-----|
| Fall detection | **Browser** (nurse-command) | `POST /api/v1/alerts/fall-report` |
| Heart rate (rPPG) | **Server** (`backend/rppg`) | `POST /api/v1/rppg` |
| Live video | **LiveKit** | `POST /api/v1/livekit/token` |

## Mock-First Development

- Patient: `NEXT_PUBLIC_USE_MOCK=true`
- Nurse: `VITE_USE_MOCK=true`

## Demo Fallback

```bash
curl -X POST http://localhost:8000/api/v1/demo/trigger-fall
```

See [`docs/DEMO.md`](docs/DEMO.md) for the full playbook.

## Cursor Rules

See [`.cursorrules`](.cursorrules) — stay in your lane; update `shared/` when changing contracts.
