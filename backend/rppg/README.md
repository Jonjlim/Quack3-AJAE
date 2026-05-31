# rPPG (remote photoplethysmography)

Server-side heart-rate analysis from short patient video clips (OpenCV + MediaPipe Face Mesh).

**Fall detection** runs in the browser (`frontend/nurse-command`) and reports via `POST /api/v1/alerts/fall-report` — not in this package.

## Setup

```bash
pip install -r backend/rppg/requirements.txt
```

## API

Consumed by triage-engine at `POST /api/v1/rppg` (see `docs/API_endpoints.md`).
