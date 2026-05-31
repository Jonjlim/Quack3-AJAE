from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root (Quack3-AJAE/) — same layout as app/main.py
REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://eroverwatch:eroverwatch@localhost:5432/eroverwatch"
    redis_url: str = "redis://localhost:6379/0"
    triage_sqlite_path: str = ""
    livekit_api_key: str = "devkey"
    livekit_api_secret: str = "secret"
    livekit_url: str = "wss://your-project.livekit.cloud"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    gemini_api_key: str = ""
    testing: bool = False
    require_firebase_auth: bool = False
    firebase_project_id: str = ""
    firebase_credentials_path: str = ""
    firebase_credentials_json: str = ""

    def resolved_firebase_credentials_path(self) -> Path | None:
        if not self.firebase_credentials_path:
            return None
        path = Path(self.firebase_credentials_path)
        if not path.is_absolute():
            path = REPO_ROOT / path
        return path


settings = Settings()
