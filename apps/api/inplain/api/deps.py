from __future__ import annotations

from collections.abc import Generator

from fastapi import Header, HTTPException
from sqlalchemy.orm import Session

from inplain.db.session import SessionLocal
from inplain.settings import settings


def require_internal_service_token(
    authorization: str | None = Header(default=None),
    x_internal_service_token: str | None = Header(default=None),
) -> None:
    token: str | None = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
    if token is None and x_internal_service_token:
        token = x_internal_service_token.strip()

    if not token or token != settings.internal_service_token:
        raise HTTPException(status_code=401, detail="unauthorized")


def get_clerk_user_id(x_clerk_user_id: str | None = Header(default=None)) -> str:
    if not x_clerk_user_id:
        raise HTTPException(status_code=400, detail="missing x-clerk-user-id")
    return x_clerk_user_id


def require_admin_role(x_clerk_role: str | None = Header(default=None)) -> None:
    if x_clerk_role != "admin":
        raise HTTPException(status_code=403, detail="forbidden")


def get_db() -> Generator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
