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
    clerk_user_id: str = "",
    clerk_role: str = "",
) -> dict[str, str]:
    ts = str(timestamp if timestamp is not None else int(time.time()))
    body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
    payload = f"{ts}\n{method.upper()}\n{path}\n{body_hash}\n{clerk_user_id}\n{clerk_role}"
    signature = hmac.new(b"dev-internal-token", payload.encode("utf-8"), hashlib.sha256).hexdigest()
    headers = {
        "x-request-timestamp": ts,
        "x-request-signature": signature,
    }
    if clerk_user_id:
        headers["x-clerk-user-id"] = clerk_user_id
    if clerk_role:
        headers["x-clerk-role"] = clerk_role
    return headers


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


def test_substituted_principal_is_rejected() -> None:
    """A signature must not validate for a different user than it was signed for.

    The principal headers used to be sent alongside the signature but not
    covered by it, so a captured request could be replayed within the skew
    window with x-clerk-user-id swapped - a cross-tenant write.
    """
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        ts = str(int(time.time()))
        body_hash = hashlib.sha256(b"").hexdigest()
        payload = f"{ts}\nGET\n/internal/entities\n{body_hash}\nuser_victim\n"
        sig = hmac.new(b"dev-internal-token", payload.encode("utf-8"), hashlib.sha256).hexdigest()

        # Signed for user_victim, replayed claiming to be user_attacker.
        res = client.get(
            "/internal/entities",
            headers={
                "x-request-timestamp": ts,
                "x-request-signature": sig,
                "x-clerk-user-id": "user_attacker",
            },
        )
        assert res.status_code == 401

        # The same signature still works for the principal it was signed for.
        ok = client.get(
            "/internal/entities",
            headers={
                "x-request-timestamp": ts,
                "x-request-signature": sig,
                "x-clerk-user-id": "user_victim",
            },
        )
        assert ok.status_code == 200
    finally:
        app.dependency_overrides.clear()


def test_forged_admin_role_is_rejected() -> None:
    """x-clerk-role gates the admin routes and must be under the signature."""
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        ts = str(int(time.time()))
        body_hash = hashlib.sha256(b"").hexdigest()
        payload = f"{ts}\nGET\n/internal/entities\n{body_hash}\nuser_1\n"
        sig = hmac.new(b"dev-internal-token", payload.encode("utf-8"), hashlib.sha256).hexdigest()

        res = client.get(
            "/internal/entities",
            headers={
                "x-request-timestamp": ts,
                "x-request-signature": sig,
                "x-clerk-user-id": "user_1",
                "x-clerk-role": "admin",
            },
        )
        assert res.status_code == 401
    finally:
        app.dependency_overrides.clear()
