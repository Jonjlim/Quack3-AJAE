import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import intake, livekit_tokens, queue
from app.ws import nurse as ws_nurse

app = FastAPI(title="ER-OVERWATCH Triage Engine", version="1.0.0")

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intake.router)
app.include_router(queue.router)
app.include_router(livekit_tokens.router)
app.include_router(ws_nurse.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "triage-engine"}
