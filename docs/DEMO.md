# ER-OVERWATCH Demo Playbook

Bulletproof the judging demo when hackathon Wi-Fi or WebRTC fails.

## Normal Path

1. Copy `.env.example` → `.env` and set LiveKit Cloud credentials
2. Start triage engine: see [README](../README.md)
3. Start nurse dashboard with live telemetry: `VITE_USE_MOCK=false npm run dev` in `frontend/nurse-command`
4. Broad camera streams via LiveKit → scene-intel samples frames → fall alert fires → sticky panel on nurse dash

## Fallback Path (No Network / No CV)

### Option A: REST demo trigger

```bash
curl -X POST http://localhost:8000/api/v1/demo/trigger-fall
```

This fires a pre-baked `CRITICAL_FALL` alert and broadcasts it to all connected nurse WebSockets.

### Option B: scene-intel CLI

```bash
cd backend/scene-intel
python fall_detection/demo_video.py --trigger
# or
python main.py --demo
```

### Option C: Local fall video file

Queue a local MP4 that simulates a patient falling:

```bash
cd backend/scene-intel
python fall_detection/demo_video.py --video /path/to/fall-demo.mp4
```

If CV doesn't detect a fall in the clip, use `--trigger` instead during judging.

## Frontend Mock Mode

Force mock data when the backend is unreachable:

| App | Env var | Value |
|-----|---------|-------|
| Patient PWA | `NEXT_PUBLIC_USE_MOCK` | `true` |
| Nurse Command | `VITE_USE_MOCK` | `true` |

Copy `.env.example` to each app's `.env.local` / `.env` as needed.

## Pitch Tip

Lead with the HIPAA pivot: patients see **Anonymized Acuity Load** (aggregate trauma burden), not individual wait lines or names. Judges respond well to teams that understand regulatory boundaries.

## Pre-Judging Checklist

- [ ] LiveKit Cloud credentials set in `.env` (token endpoint returns a valid JWT)
- [ ] `curl http://localhost:8000/health` returns `{"status":"ok"}`
- [ ] Nurse dash loads at http://localhost:5173
- [ ] Patient PWA loads at http://localhost:3000
- [ ] Tested `POST /api/v1/demo/trigger-fall` → sticky alert appears
- [ ] Local fall video file queued (optional)
- [ ] Mock mode env vars set as backup
