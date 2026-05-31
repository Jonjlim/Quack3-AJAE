import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import intake, livekit_tokens, queue, rppg, casefile
from app.ws import nurse as ws_nurse


@asynccontextmanager
async def lifespan(app: FastAPI):
    ticker = None
    if not settings.testing:
        ticker = asyncio.create_task(ws_nurse.wait_time_ticker(interval_seconds=30))
    yield
    if ticker is not None:
        ticker.cancel()
        try:
            await ticker
        except asyncio.CancelledError:
            pass


app = FastAPI(title="ER-OVERWATCH Triage Engine", version="1.0.0", lifespan=lifespan)

origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
# Allow phone/tablet dev clients on the same Wi-Fi without listing every LAN IP.
lan_origin_regex = (
    r"https?://("
    r"localhost|127\.0\.0\.1|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r")(:\d+)?"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_origin_regex=lan_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(intake.router)
app.include_router(queue.router)
app.include_router(livekit_tokens.router)
app.include_router(rppg.router)
app.include_router(casefile.router)
app.include_router(ws_nurse.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "triage-engine"}
