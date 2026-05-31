"""Firebase Admin SDK initialization and token verification."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import settings

_firebase_initialized = False


@dataclass(frozen=True)
class FirebaseUser:
    uid: str
    role: str | None
    patient_id: str | None


def _load_cred_dict() -> dict[str, Any] | None:
    if settings.firebase_credentials_json:
        return json.loads(settings.firebase_credentials_json)
    cred_path = settings.resolved_firebase_credentials_path()
    if cred_path and cred_path.is_file():
        return json.loads(cred_path.read_text(encoding="utf-8"))
    return None


def _project_id(cred_dict: dict[str, Any] | None) -> str:
    if settings.firebase_project_id:
        return settings.firebase_project_id
    if cred_dict and cred_dict.get("project_id"):
        return str(cred_dict["project_id"])
    return ""


def _ensure_firebase() -> None:
    global _firebase_initialized
    if _firebase_initialized:
        return
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:
        _firebase_initialized = True
        return

    cred_dict = _load_cred_dict()
    project_id = _project_id(cred_dict)
    if not project_id:
        raise RuntimeError(
            "Firebase project ID missing. Set FIREBASE_PROJECT_ID in .env or use a service account JSON with project_id."
        )

    options = {"projectId": project_id}

    if cred_dict:
        cred = credentials.Certificate(cred_dict)
    else:
        cred = credentials.ApplicationDefault()

    firebase_admin.initialize_app(cred, options)
    _firebase_initialized = True


def verify_bearer_token(token: str) -> FirebaseUser:
    _ensure_firebase()
    from firebase_admin import auth

    decoded: dict[str, Any] = auth.verify_id_token(token)
    role = decoded.get("role")
    patient_id = decoded.get("patient_id")
    return FirebaseUser(
        uid=decoded["uid"],
        role=role if isinstance(role, str) else None,
        patient_id=patient_id if isinstance(patient_id, str) else None,
    )


def set_user_claims(uid: str, claims: dict[str, str]) -> None:
    _ensure_firebase()
    from firebase_admin import auth

    auth.set_custom_user_claims(uid, claims)


def firebase_auth_enabled() -> bool:
    return settings.require_firebase_auth
