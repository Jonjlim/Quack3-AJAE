"""WebSocket Firebase token verification."""

from __future__ import annotations

from app.firebase_app import FirebaseUser, firebase_auth_enabled, verify_bearer_token


class WsAuthError(Exception):
    pass


def verify_ws_token(token: str | None) -> FirebaseUser:
    if not firebase_auth_enabled():
        return FirebaseUser(uid="dev", role=None, patient_id=None)
    if not token:
        raise WsAuthError("token query param required")
    try:
        return verify_bearer_token(token)
    except Exception as exc:
        raise WsAuthError("Invalid or expired Firebase token") from exc
