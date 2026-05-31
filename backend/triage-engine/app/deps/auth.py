"""FastAPI dependencies for Firebase Auth."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.firebase_app import FirebaseUser, firebase_auth_enabled, verify_bearer_token

_bearer = HTTPBearer(auto_error=False)


def _extract_token(
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    return credentials.credentials


async def require_firebase_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> FirebaseUser:
    if not firebase_auth_enabled():
        return FirebaseUser(uid="dev", role=None, patient_id=None)
    token = _extract_token(credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer token required",
        )
    try:
        return verify_bearer_token(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase token",
        ) from exc


async def require_nurse(user: FirebaseUser = Depends(require_firebase_user)) -> FirebaseUser:
    if not firebase_auth_enabled():
        return user
    if user.role != "nurse":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nurse role required",
        )
    return user


def assert_patient_match(user: FirebaseUser, patient_id: str) -> None:
    if not firebase_auth_enabled():
        return
    if user.role != "patient" or user.patient_id != patient_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Patient session does not match this patient_id",
        )
