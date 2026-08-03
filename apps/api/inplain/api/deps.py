from __future__ import annotations

import hashlib
import hmac
import time
from collections.abc import Generator

from fastapi import Header, HTTPException, Request
from sqlalchemy.orm import Session

from inplain.db.session import SessionLocal
from inplain.settings import settings

_HMAC_MAX_SKEW_SECONDS = 300


def _canonical_hmac_payload(*, timestamp: str, method: str, path: str, body_hash: str) -> str:
    return f"{timestamp}\n{method.upper()}\n{path}\n{body_hash}"


def _body_sha256(body: bytes) -> str:
    return hashlib.sha256(body).hexdigest()


def _hmac_hexdigest(*, secret: str, payload: str) -> str:
    return hmac.new(secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def _verify_hmac_headers(
    *,
    method: str,
    path: str,
    body: bytes,
    signature: str,
    timestamp: str,
) -> bool:
    try:
        ts = int(timestamp)
    except ValueError:
        return False

    now = int(time.time())
    if abs(now - ts) > _HMAC_MAX_SKEW_SECONDS:
        return False

    supplied = signature.removeprefix("sha256=").strip().lower()
    if not supplied:
        return False

    payload = _canonical_hmac_payload(
        timestamp=timestamp,
        method=method,
        path=path,
        body_hash=_body_sha256(body),
    )
    expected = _hmac_hexdigest(secret=settings.internal_service_token, payload=payload)
    return hmac.compare_digest(supplied, expected)


async def require_internal_service_token(
    request: Request,
    x_request_signature: str | None = Header(default=None),
    x_request_timestamp: str | None = Header(default=None),
) -> None:
    """Authenticate an internal (web -> api) call.

    HMAC signature only. A bearer-token fallback used to be accepted here, which
    meant anyone holding the shared secret could replay a captured request
    indefinitely - the exact thing the signature's timestamp binding exists to
    prevent. Every caller (the Next BFF, the smoke test, the tests) signs, so
    the fallback was dead code that only weakened the guarantee.
    """
    path = request.url.path
    if request.url.query:
        path = f"{path}?{request.url.query}"

    if not (x_request_signature and x_request_timestamp):
        raise HTTPException(status_code=401, detail="unauthorized")

    body = await request.body()
    if not _verify_hmac_headers(
        method=request.method,
        path=path,
        body=body,
        signature=x_request_signature,
        timestamp=x_request_timestamp,
    ):
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
