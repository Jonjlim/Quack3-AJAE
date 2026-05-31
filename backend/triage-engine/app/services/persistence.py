"""SQLite snapshot persistence for triage state.

Saves the full patients + alerts list as JSON on every mutation so the
backend can survive a restart without losing demo data.
"""

import json
import logging
import sqlite3
from pathlib import Path

from shared.schemas.telemetry import AlertEvent, PatientRecord

logger = logging.getLogger(__name__)

_DB_PATH: Path | None = None


def configure(db_path: str | Path) -> None:
    global _DB_PATH
    _DB_PATH = Path(db_path)
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    _migrate()


def _connect() -> sqlite3.Connection:
    if _DB_PATH is None:
        raise RuntimeError("persistence not configured — call configure() first")
    return sqlite3.connect(str(_DB_PATH))


def _migrate() -> None:
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS snapshots (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        conn.commit()


def load_persisted_state() -> tuple[list[PatientRecord], list[AlertEvent]] | None:
    if _DB_PATH is None or not _DB_PATH.exists():
        return None
    try:
        with _connect() as conn:
            row = conn.execute(
                "SELECT value FROM snapshots WHERE key = 'patients'"
            ).fetchone()
            if row is None:
                return None
            patients = [PatientRecord.model_validate(p) for p in json.loads(row[0])]

            row = conn.execute(
                "SELECT value FROM snapshots WHERE key = 'alerts'"
            ).fetchone()
            alerts = [AlertEvent.model_validate(a) for a in json.loads(row[0])] if row else []

        logger.info("Loaded %d patient(s) and %d alert(s) from SQLite", len(patients), len(alerts))
        return patients, alerts
    except Exception as exc:
        logger.warning("Could not load persisted state: %s — starting fresh", exc)
        return None


def persist_state(patients: list[PatientRecord], alerts: list[AlertEvent]) -> None:
    if _DB_PATH is None:
        return
    try:
        patients_json = json.dumps([p.model_dump(mode="json") for p in patients])
        alerts_json = json.dumps([a.model_dump(mode="json") for a in alerts])
        with _connect() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO snapshots (key, value) VALUES ('patients', ?)",
                (patients_json,),
            )
            conn.execute(
                "INSERT OR REPLACE INTO snapshots (key, value) VALUES ('alerts', ?)",
                (alerts_json,),
            )
            conn.commit()
    except Exception as exc:
        logger.warning("Could not persist state: %s", exc)
