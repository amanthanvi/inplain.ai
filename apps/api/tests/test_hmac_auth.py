from __future__ import annotations

import hashlib
import hmac
import time
from collections.abc import Generator

from fastapi.testclient import TestClient

from inplain.api.deps import get_db
from inplain.api.main import app


class _DummyScalarResult:
    def all(self) -> list[object]:
        return []


class _DummyExecuteResult:
    def scalars(self) -> _DummyScalarResult:
        return _DummyScalarResult()


class _DummyDB:
    def execute(self, *_args: object, **_kwargs: object) -> _DummyExecuteResult:
        return _DummyExecuteResult()

    def close(self) -> None:  # pragma: no cover
        return


def _override_get_db() -> Generator[_DummyDB]:
    yield _DummyDB()


def _signed_headers(
    *,
    method: str,
    path: str,
    body: str = "",
    timestamp: int | None = None,
) -> dict[str, str]:
    ts = str(timestamp if timestamp is not None else int(time.time()))
    body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
    payload = f"{ts}\n{method.upper()}\n{path}\n{body_hash}"
    signature = hmac.new(b"dev-internal-token", payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return {
        "x-request-timestamp": ts,
        "x-request-signature": signature,
    }


def test_hmac_allows_valid_signed_request() -> None:
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        headers = _signed_headers(method="GET", path="/internal/entities")
        res = client.get("/internal/entities", headers=headers)
        assert res.status_code == 200
    finally:
        app.dependency_overrides.clear()


def test_hmac_rejects_invalid_signature() -> None:
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        headers = _signed_headers(method="GET", path="/internal/entities")
        headers["x-request-signature"] = "invalid"
        res = client.get("/internal/entities", headers=headers)
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "UNAUTHORIZED"
    finally:
        app.dependency_overrides.clear()


def test_hmac_rejects_stale_timestamp() -> None:
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        stale = int(time.time()) - 601
        headers = _signed_headers(method="GET", path="/internal/entities", timestamp=stale)
        res = client.get("/internal/entities", headers=headers)
        assert res.status_code == 401
        assert res.json()["error"]["code"] == "UNAUTHORIZED"
    finally:
        app.dependency_overrides.clear()
