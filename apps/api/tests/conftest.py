from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

import inplain.db.models  # noqa: F401
from inplain.db.base import Base


@pytest.fixture(scope="session")
def test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set (skipping integration tests)")
    return url


@pytest.fixture(scope="session")
def test_engine(test_database_url: str) -> Generator[Engine]:
    engine = create_engine(test_database_url, pool_pre_ping=True)
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture()
def db(test_engine: Engine) -> Generator[Session]:
    with test_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE TABLE "
                "notifications, jobs, change_events, diffs, snapshots, documents, entities "
                "CASCADE"
            )
        )

    SessionLocal = sessionmaker(bind=test_engine, class_=Session, expire_on_commit=False)
    with SessionLocal() as session:
        yield session



def signed_headers(
    *,
    method: str,
    path: str,
    body: bytes = b"",
    token: str = "dev-internal-token",
    clerk_user_id: str = "",
    clerk_role: str = "",
) -> dict[str, str]:
    """Build HMAC headers for an internal API call.

    The API accepts signed requests only - there is no bearer-token fallback -
    so every test request must be signed. `path` must include the query string
    when present, matching `require_internal_service_token`.
    """
    ts = str(int(time.time()))
    payload = (
        f"{ts}\n{method.upper()}\n{path}\n{hashlib.sha256(body).hexdigest()}"
        f"\n{clerk_user_id}\n{clerk_role}"
    )
    signature = hmac.new(
        token.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    headers = {"x-request-timestamp": ts, "x-request-signature": signature}
    if clerk_user_id:
        headers["x-clerk-user-id"] = clerk_user_id
    if clerk_role:
        headers["x-clerk-role"] = clerk_role
    return headers


class SignedClient:
    """TestClient wrapper that signs each request individually."""

    def __init__(self, client: TestClient, clerk_user_id: str | None = None) -> None:
        self._client = client
        self._clerk_user_id = clerk_user_id

    def request(
        self,
        method: str,
        path: str,
        *,
        json_body: object | None = None,
        clerk_user_id: str | None = None,
        extra_headers: dict[str, str] | None = None,
    ):
        body = b"" if json_body is None else json.dumps(json_body).encode("utf-8")
        user = clerk_user_id if clerk_user_id is not None else self._clerk_user_id
        headers = signed_headers(
            method=method, path=path, body=body, clerk_user_id=user or ""
        )
        if json_body is not None:
            headers["content-type"] = "application/json"
        if extra_headers:
            headers.update(extra_headers)
        return self._client.request(method, path, content=body or None, headers=headers)

    def get(self, path: str, **kw):
        return self.request("GET", path, **kw)

    def post(self, path: str, **kw):
        return self.request("POST", path, **kw)

    def __getattr__(self, name: str):
        return getattr(self._client, name)
