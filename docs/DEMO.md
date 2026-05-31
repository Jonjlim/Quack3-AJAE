# ER-OVERWATCH Demo Playbook

Bulletproof the judging demo when hackathon Wi-Fi or WebRTC fails.

## Normal Path

1. Copy `.env.example` → `.env` and set LiveKit Cloud credentials
2. Start triage engine (see [README](../README.md))
3. Start nurse dashboard: `VITE_USE_MOCK=false npm run dev` in `frontend/nurse-command`
4. Nurse checks in a patient → share **patient ID** with patient PWA
5. Patient signs in at https://localhost:3000 with that ID
6. Open **Room Camera** at `/camera` on a room device — fall detection runs **in the browser** on that page
7. On nurse dashboard: **Connect feed** to view the room stream and patient cameras
7. When a fall is detected, `CRITICAL_FALL` appears in the sticky alerts panel

## Fall detection (browser)

- No Gemini API and no video upload to the backend
- Logic: `frontend/nurse-command/src/lib/browserFallDetector.ts`
- Reports via `POST /api/v1/alerts/fall-report`
- Requires camera permission on the room device at `/camera`

## rPPG vitals (server)

- Patient enables camera on queue page → short clips → `POST /api/v1/rppg`
- Backend: `backend/rppg` (OpenCV + MediaPipe)

## Fallback Path (No Camera / No Network)

### Option A: REST demo trigger

```bash
curl -X POST http://localhost:8000/api/v1/demo/trigger-fall
```

Fires a pre-baked `CRITICAL_FALL` alert to all connected nurse WebSockets.

### Option B: Manual fall report (simulates browser)

```bash
curl -X POST http://localhost:8000/api/v1/alerts/fall-report \
  -H "Content-Type: application/json" \
  -d '{"confidence":0.92,"danger_level":"high","source":"browser"}'
```

## Frontend Mock Mode

| App | Env var | Value |
|-----|---------|-------|
| Patient PWA | `NEXT_PUBLIC_USE_MOCK` | `true` |
| Nurse Command | `VITE_USE_MOCK` | `true` |

## Pitch Tip

Lead with the HIPAA pivot: patients see **Anonymized Acuity Load** (aggregate trauma burden), not individual wait lines or names.

## Pre-Judging Checklist

- [ ] LiveKit credentials in `.env` (token endpoint returns JWT)
- [ ] `curl http://localhost:8000/health` → `{"status":"ok"}`
- [ ] Nurse dash http://localhost:5173 — check in patient, note patient ID
- [ ] Patient PWA https://localhost:3000 — sign in with patient ID
- [ ] `POST /api/v1/demo/trigger-fall` → sticky alert (fallback tested)
- [ ] Room camera page `/camera` open on a tablet for live fall detection demo
