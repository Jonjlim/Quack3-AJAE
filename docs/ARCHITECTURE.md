# ER-OVERWATCH Architecture

## Overview

```text
┌─────────────────────┐     REST / WS      ┌──────────────────────┐
│  patient-client     │◄──────────────────►│  triage-engine       │
│  (Next.js PWA)      │                    │  (FastAPI :8000)     │
│  · queue + sign-in  │                    │  · patients / queue  │
│  · rPPG clips ──────┼── POST /rppg ─────►│  · alerts / intake │
└─────────────────────┘                    └──────────▲───────────┘
                                                        │
┌─────────────────────┐     REST / WS                 │
│  nurse-command      │◄──────────────────────────────┘
│  (Vite dashboard)   │
│  · triage grid      │     POST /alerts/fall-report
│  · fall detection   │──── (browser-only, no video upload)
│    in browser       │
│  · LiveKit feeds    │◄──► LiveKit Cloud
└─────────────────────┘
```

## Video processing split

| Concern | Where it runs | How nurses/patients see it |
|---------|---------------|---------------------------|
| **Fall detection** | Browser (`nurse-command` local or room camera stream) | `CRITICAL_FALL` on nurse WebSocket after `POST /api/v1/alerts/fall-report` |
| **rPPG vitals** | Server (`backend/rppg`, OpenCV + MediaPipe) | Patient uploads short clips → `POST /api/v1/rppg` → biometrics on nurse grid |
| **Room / patient video** | LiveKit WebRTC | Wide-angle panel + per-patient modal |

Fall detection **does not** call Gemini or upload 30s clips to the backend. Legacy `backend/scene-intel/fall_detection/` is deprecated.

## Repository layout

```text
Quack3-AJAE/
├── frontend/
│   ├── patient-client/       # Patient sign-in, queue, camera + rPPG sampling
│   └── nurse-command/        # Dashboard, check-in, browser fall detection, LiveKit
├── backend/
│   ├── triage-engine/        # REST, WebSockets, LiveKit tokens, alert routing
│   └── rppg/                 # Server-side heart-rate from face video clips
├── shared/                   # Pydantic + TypeScript contracts
└── docs/
    ├── API_endpoints.md
    ├── ARCHITECTURE.md       # this file
    └── DEMO.md
```

`backend/scene-intel/` is **legacy only** (old Gemini fall path). Do not extend it.

## Fall detection flow (browser)

1. Room device opens **`/camera`** and publishes to LiveKit; browser fall detection runs on that stream.
2. `browserFallDetector.ts` samples frames from the `MediaStream` (~4 Hz).
3. Motion heuristics detect a rapid drop-like event in the lower frame band.
4. `useFallDetection` POSTs JSON to `/api/v1/alerts/fall-report` (confidence ≥ 0.6, danger `medium`/`high`).
5. Triage engine creates `CRITICAL_FALL` and broadcasts on `ws://…/ws/nurse`.

## rPPG flow (server)

1. Patient opts in to camera on the queue page.
2. `useRppgSampler` records ~8s clips and POSTs to `/api/v1/rppg` with `patient_id`.
3. `backend/rppg` extracts face ROI, runs CHROM + FFT, returns HR + confidence.
4. Triage engine updates `PatientRecord.last_biometric` and may fire `BIOMETRIC_DROP`.

## Demo fallback

`POST /api/v1/demo/trigger-fall` fires a canned alert without any camera (judging Wi‑Fi / CV failure).
