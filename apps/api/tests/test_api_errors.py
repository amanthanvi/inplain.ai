from __future__ import annotations

from collections.abc import Generator

from fastapi.testclient import TestClient

from inplain.api.deps import get_db
from inplain.api.main import app


class _DummyDB:
    def close(self) -> None:  # pragma: no cover
        return


def _override_get_db() -> Generator[_DummyDB]:
    yield _DummyDB()


def test_internal_requires_service_token() -> None:
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        res = client.get("/internal/entities")
        assert res.status_code == 401
        data = res.json()
        assert "error" in data
        assert data["error"]["code"] == "UNAUTHORIZED"
    finally:
        app.dependency_overrides.clear()


def test_missing_clerk_user_id_is_standard_error() -> None:
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        res = client.get(
            "/internal/documents",
            headers={"authorization": "Bearer dev-internal-token"},
        )
        assert res.status_code == 400
        data = res.json()
        assert data["error"]["code"] == "BAD_REQUEST"
    finally:
        app.dependency_overrides.clear()

