# ER-OVERWATCH

Zero-install, real-time emergency room telemetry and triage optimization platform. Bridges the data gap between an overcrowded ER waiting room and overwhelmed medical staff.

**HIPAA pivot:** Patients see an **Anonymized Acuity Load** (aggregate trauma burden), not individual wait lines or other patients' names.

## Project Structure

```text
Quack3-AJAE/
├── frontend/
│   ├── patient-client/    # Architect 1 — Next.js 14 PWA
│   └── nurse-command/     # Architect 2 — React 19 / Vite dashboard
├── backend/
│   ├── triage-engine/     # Architect 3 — FastAPI + WebSockets
│   └── scene-intel/       # Architect 4 — OpenCV / rPPG / Vision
├── shared/                # Pydantic schemas + TypeScript types
└── docs/                  # API contract + demo playbook
```

| Folder | Owner | Stack |
|--------|-------|-------|
| [`frontend/patient-client/`](frontend/patient-client/) | Architect 1 | Next.js 14, Tailwind 4, LiveKit |
| [`frontend/nurse-command/`](frontend/nurse-command/) | Architect 2 | React 19, Vite, Tailwind 4, LiveKit |
| [`backend/triage-engine/`](backend/triage-engine/) | Architect 3 | FastAPI, Python 3.11, Pydantic v2 |
| [`backend/scene-intel/`](backend/scene-intel/) | Architect 4 | OpenCV, MediaPipe, OpenAI Vision |
| [`shared/`](shared/) | Architect 3 (schemas) | Pydantic + TypeScript mirrors |

Integration contract: [`docs/API_endpoints.md`](docs/API_endpoints.md)  
Demo playbook: [`docs/DEMO.md`](docs/DEMO.md)

## Quick Start

### 1. Environment

```bash
cp .env.example .env
# Fill in LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL from your LiveKit Cloud project
```

### 2. Triage Engine (Architect 3)

```bash
cd backend/triage-engine
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

Or manually: `PYTHONPATH=<repo-root> uvicorn app.main:app --reload --port 8000`

### 3. Patient PWA (Architect 1)

```bash
cd frontend/patient-client
npm install
npm run dev
```

Open http://localhost:3000

### 4. Nurse Command (Architect 2)

```bash
cd frontend/nurse-command
npm install
npm run dev
```

Open http://localhost:5173

### 5. Scene Intelligence (Architect 4)

```bash
cd backend/scene-intel
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py --demo   # fires demo fall alert
```

## Mock-First Development

Until endpoints are live, frontends use hardcoded JSON matching `docs/API_endpoints.md`:

- Patient: `NEXT_PUBLIC_USE_MOCK=true`
- Nurse: `VITE_USE_MOCK=true`

## Cursor Rules

See [`.cursorrules`](.cursorrules) — stay in your lane. Do not cross app directory boundaries without updating shared schemas.

## Demo Fallback

If WebRTC or Wi-Fi fails during judging:

```bash
curl -X POST http://localhost:8000/api/v1/demo/trigger-fall
```

See [`docs/DEMO.md`](docs/DEMO.md) for the full playbook.
