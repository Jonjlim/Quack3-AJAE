from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"), env_file_encoding="utf-8", extra="ignore"
    )


    database_url: str = "postgresql://eroverwatch:eroverwatch@localhost:5432/eroverwatch"
    redis_url: str = "redis://localhost:6379/0"
    livekit_api_key: str = "devkey"
    livekit_api_secret: str = "secret"
    livekit_url: str = "wss://your-project.livekit.cloud"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    testing: bool = False


settings = Settings()
