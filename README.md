<h1 align="center">ER-OVERWATCH</h1>

<p align="center"><b>Turn an ER waiting room's ordinary webcams and patients' phones into fall detectors, contactless heart-rate monitors, and an AI intake assistant, all feeding one live triage dashboard for nurses.</b></p>

<p align="center">
  <a href="https://2026.quackhacks.org/projects/winners/er-overwatch"><img src="https://img.shields.io/badge/Winner-1st%20Place%20Overall%20%C2%B7%20QuackHacks%202026%20(71%20projects)-gold?style=for-the-badge" alt="1st Place Overall, QuackHacks 2026, out of 71 projects"></a>
</p>

<p align="center">
  <a href="https://2026.quackhacks.org/projects/winners/er-overwatch">QuackHacks project page</a> ·
  <a href="https://www.youtube.com/watch?v=7biBbQWCngY">Demo video</a> ·
  <a href="#run-locally">Run locally</a> ·
  <a href="docs/DEMO.md">Demo script</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="docs/API_endpoints.md">API</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white" alt="FastAPI">
  <img src="https://img.shields.io/badge/Python_3.11-3776AB?logo=python&logoColor=white" alt="Python 3.11">
  <img src="https://img.shields.io/badge/React_19-20232A?logo=react&logoColor=61DAFB" alt="React 19">
  <img src="https://img.shields.io/badge/Next.js_14-000000?logo=nextdotjs&logoColor=white" alt="Next.js 14">
  <img src="https://img.shields.io/badge/MediaPipe-0097A7?logo=google&logoColor=white" alt="MediaPipe">
  <img src="https://img.shields.io/badge/OpenCV-5C3EE8?logo=opencv&logoColor=white" alt="OpenCV">
  <img src="https://img.shields.io/badge/Google_Gemini-8E75B2?logo=googlegemini&logoColor=white" alt="Google Gemini">
  <img src="https://img.shields.io/badge/LiveKit-1F1F1F?logo=webrtc&logoColor=white" alt="LiveKit">
</p>

**1st Place Overall at QuackHacks 2026 ([QuackHacks 3](https://2026.quackhacks.org/projects/winners/er-overwatch), University of Oregon), out of 71 projects.**

## Why it's cool

Emergency-room patients can wait for hours while nurses track triage, vitals, and room safety by hand. ER-OVERWATCH covers all of it with hardware a hospital already has. MediaPipe pose tracking on the nurses' camera feeds draws a box around each person and flags collapses. A room camera can also send short frame sequences to Gemini to catch slower slumps. Patients scan a QR code to join the queue on their own phone. With their consent, the phone records 8-second face clips, and the backend turns them into a heart-rate estimate using the CHROM rPPG method. While patients wait, a Gemini intake assistant builds a case file the doctor can download as a PDF. Every alert reaches the nurse dashboard over WebSockets in real time.

## Highlights

- **1st place overall out of 71 projects** at QuackHacks 2026.
- **Three services, one platform:** a FastAPI triage engine with 24 REST/WebSocket routes, a React 19 nurse dashboard, and a Next.js 14 patient PWA.
- **In-browser pose tracking** of up to 4 people per camera feed (MediaPipe Pose Landmarker, GPU with CPU fallback).
- **Gemini fall analysis** of a 9-second multi-frame window. The room camera captures a snapshot every 1 s, or a 5 s clip sent every 2 s.
- **Contactless heart rate** from 8-second phone clips: CHROM chrominance, a Butterworth band-pass filter, and autocorrelation + FFT fusion, gated by motion and confidence.
- **Human in the loop:** Gemini drafts advisory intake notes, but a nurse always sets the acuity.
- **Runs without keys:** mock mode with seeded data in both frontends, plus a demo fall-alert endpoint.

## What it does

- **Nurse check-in and triage dashboard.** A nurse checks a patient in with a name and chief complaint. Gemini drafts an advisory clinical observation note, but the nurse always sets the acuity. Patients join the queue on their phone by QR code. The dashboard shows a live patient grid, biometrics, and alerts over WebSockets.
- **Patient queue PWA.** Patients see their own queue position and an aggregate "acuity load" for the department. They never see other patients' names or wait times. They can request help from the waiting room.
- **Contactless heart rate (rPPG).** If the patient opts in, their phone camera records about 8-second face clips. The backend estimates heart rate using the CHROM method with OpenCV and MediaPipe Face Mesh, and returns a confidence score. Abnormal readings raise an alert on the nurse grid.
- **Fall detection, two ways:**
  - **Room camera (`/camera`):** a room device streams to LiveKit and sends periodic frames or short clips to the backend. Gemini analyzes the frames across a 9-second window to catch collapses and slow slumps.
  - **Dashboard feeds:** lightweight in-browser motion and pose heuristics run on the nurse dashboard's video feeds.

  A confirmed fall sends a CRITICAL alert to every nurse client.
- **AI case-file assistant.** While waiting, patients can talk to a Gemini intake assistant by voice or text. It asks follow-up questions about how the problem started, symptoms, and history. Nurses can then generate a structured case-file report or PDF for the doctor.
- **Demo-friendly.** Both frontends have a mock mode with seeded data, and `POST /api/v1/demo/trigger-fall` fires a sample fall alert.

## Engineering highlights

| Area | What we built | Where |
|---|---|---|
| **Real-time alerting** | A WebSocket connection manager pushes patient, vitals, and CRITICAL fall events to every nurse client. The queue is ordered by acuity, escalation, and wait time. | `backend/triage-engine/app/ws/`, `services/events.py`, `services/triage.py` |
| **In-browser fall detection** | MediaPipe Pose Landmarker (full model) tracks multiple people and draws bounding boxes on the nurse feeds. A temporal classifier then flags falls and collapses. Only a small JSON alert leaves the browser. | `frontend/nurse-command/src/lib/nurseFeedDetector.ts`, `browserFallDetector.ts`, `poseDistressClassifier.ts` |
| **Multi-frame AI fall analysis** | Room-camera snapshots go into a ring buffer for each room. Gemini judges the whole 9-second sequence instead of a single frame, so slow slumps are caught as well as sudden falls. | `frontend/nurse-command/src/hooks/useFallDetection.ts`, `app/services/snapshot_store.py`, `backend/scene-intel/fall_detection/detector.py` |
| **rPPG pipeline** | OpenCV + MediaPipe Face Mesh pick a forehead region. The CHROM signal goes through a Butterworth band-pass and FFT/autocorrelation fusion, and readings are rejected when there's motion or low confidence. | `backend/rppg/rppg.py`, `app/services/rppg_bridge.py`, `frontend/patient-client/lib/useRppgSampler.ts` |
| **AI case file** | A voice/text Gemini intake chat produces a structured report and a ReportLab PDF. | `app/routers/casefile.py`, `app/services/casefile.py` |
| **Video infrastructure** | A LiveKit token service and WebRTC room video connect patient and room devices to the dashboard. | `app/routers/livekit_tokens.py` |
| **Shared contracts** | Telemetry schemas are mirrored in Python and TypeScript. | `shared/schemas/telemetry.py`, `shared/types/telemetry.ts` |

## Architecture

```text
 patient-client (Next.js 14 PWA, :3000)          nurse-command (React 19 + Vite, :5173)
 ├─ sign-in, queue, help request                 ├─ check-in, patient grid, alerts, case-file reports
 ├─ rPPG clip upload ───────────┐                ├─ /camera room device → LiveKit + Gemini fall analysis
 └─ case-file chat ─────────┐   │                └─ in-browser motion/pose fall heuristics
                            ▼   ▼                          │ REST + WebSocket
                  triage-engine (FastAPI, :8000) ◄─────────┘
                  ├─ queue / acuity engine, alert routing, SQLite persistence
                  ├─ rPPG bridge → backend/rppg (OpenCV + MediaPipe, CHROM + FFT)
                  ├─ Gemini: intake notes, case-file chat/report, multi-frame fall analysis (backend/scene-intel)
                  └─ LiveKit token service  ──►  LiveKit Cloud (WebRTC room video)
```

## Tech stack

| Layer | Technologies |
|---|---|
| Patient app | Next.js 14, React 18, Tailwind CSS 4, LiveKit React SDK, Firebase Auth (optional) |
| Nurse dashboard | React 19, Vite 6, Tailwind CSS 4, LiveKit React SDK, MediaPipe Tasks (in-browser) |
| Backend | Python 3.11, FastAPI, Pydantic v2, WebSockets, Uvicorn, SQLite, ReportLab (PDF) |
| Computer vision | OpenCV, MediaPipe Face Mesh, NumPy, SciPy (Butterworth filter + FFT) |
| AI & services | Google Gemini (`google-genai`), LiveKit Cloud, Firebase (optional) |
| Deploy configs | Dockerfile + `railway.toml` (backend), `vercel.json` (nurse dashboard) |

## Run locally

**Requirements:** Python **3.11**, Node.js 18+, and `openssl` (the patient app generates a local HTTPS certificate). For real video you need a [LiveKit Cloud](https://cloud.livekit.io) project, and for AI features a [Gemini API key](https://aistudio.google.com).

1. **Configure.** All three services read the repository-root `.env`.
   ```bash
   cp .env.example .env    # then fill in values
   ```
2. **Start everything** (macOS/Linux; use `start-all.bat` on Windows). The script installs dependencies, loads `.env`, and starts all three services:
   ```bash
   bash start-all.sh            # add --skip-install on later runs
   ```
   Or start each service by hand:
   ```bash
   # backend: http://localhost:8000  (Swagger UI at /docs)
   cd backend/triage-engine && python3.11 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt && ./run.sh

   # patient PWA: https://localhost:3000
   cd frontend/patient-client && npm install && npm run dev

   # nurse dashboard: http://localhost:5173  (room camera at /camera)
   cd frontend/nurse-command && npm install && npm run dev
   ```
   When you start the services by hand, the patient app does **not** read the root `.env`. Export the variables first (`set -a; source .env; set +a`) or copy the `NEXT_PUBLIC_*` values into `frontend/patient-client/.env.local`.
3. **No keys?** Set `NEXT_PUBLIC_USE_MOCK=true` and `VITE_USE_MOCK=true` to run both UIs on seeded mock data. To fire a demo fall alert:
   ```bash
   curl -X POST http://localhost:8000/api/v1/demo/trigger-fall
   ```

**Tests:** `cd backend/triage-engine && pytest` · `cd backend/rppg && pytest test_rppg.py -v`

> **Known issue:** `npm run build` in `frontend/nurse-command` currently fails type-checking (`src/hooks/useFallDetection.ts` references an undefined `API_BASE`). `npm run dev` still serves the dashboard, but the `/camera` page's Gemini fall uploads hit the same error at runtime.

**Environment variables** (names only, all from `.env.example`)

| Service | Variables |
|---|---|
| Backend | `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `GEMINI_API_KEY`, `CORS_ORIGINS`, `REQUIRE_FIREBASE_AUTH`, `FIREBASE_PROJECT_ID`, `FIREBASE_CREDENTIALS_PATH` |
| Patient app | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USE_MOCK`, `NEXT_PUBLIC_REQUIRE_FIREBASE_AUTH`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` |
| Nurse dashboard | `VITE_API_URL`, `VITE_PATIENT_CLIENT_URL`, `VITE_USE_MOCK`, `VITE_REQUIRE_FIREBASE_AUTH`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` |

Firebase auth is optional and off by default. See [`docs/FIREBASE_AUTH.md`](docs/FIREBASE_AUTH.md). Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/API_endpoints.md`](docs/API_endpoints.md), [`docs/DEMO.md`](docs/DEMO.md).

## Privacy design

- Patients see only an aggregate acuity load, never other patients' identities or wait times.
- rPPG clips are written to a temporary file, analyzed, and deleted.
- Gemini notes are advisory. A nurse always owns the acuity decision.
- **Room-camera fall analysis sends frames or short clips to the backend and on to Gemini.** The in-browser dashboard heuristics send only a small JSON alert. A real deployment would need a reviewed data-handling agreement before using either.

## Team

| Member | Focus |
|---|---|
| Ally Chen ([@allyytc](https://github.com/allyytc)) | Nurse command dashboard, check-in UI, MediaPipe fall detection with bounding boxes on nurse video feeds, Gemini triage-analysis integration |
| Jonathon Lim ([@Jonjlim](https://github.com/Jonjlim)) | LiveKit video, Gemini multi-snapshot fall detection, deployment, nurse dashboard features and UI polish |
| Ekansh Arora ([@ekanshArora123](https://github.com/ekanshArora123)) | Gemini scene-intel functions, first fall-detection pipeline, AI case-file generation, start scripts |
| Alan Nguyen ([@ahlawnh](https://github.com/ahlawnh)) | Patient and nurse UIs, rPPG reliability, SQLite persistence, Firebase auth, critical fall-alert modal |

## What we learned

- **rPPG on phones is hard.** Lighting changes and movement add a lot of noise, so we added smoothing, multi-sample buffering, and confidence gating.
- **WebSockets beat polling** for a dashboard that has to react to alerts immediately.
- **Keep the AI advisory.** Gemini drafts notes and flags possible falls, but people make the clinical decisions.

## Roadmap

- Respiratory-rate estimation (the data model has a field for it, but it isn't implemented yet).
- Alert acknowledgment workflow with an audit trail.
- Multi-room routing; EHR integration (HL7 FHIR).
- On-device rPPG to reduce server load.

> Hackathon prototype for demonstration only. Not a medical device and not clinically validated.
