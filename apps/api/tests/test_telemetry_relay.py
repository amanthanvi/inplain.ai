from __future__ import annotations

from collections.abc import Generator
from typing import Any

from conftest import signed_headers
from fastapi.testclient import TestClient

from inplain.api.deps import get_db
from inplain.api.main import app
from inplain.api.routes import internal_telemetry as telemetry_route


class _DummyDB:
    def close(self) -> None:  # pragma: no cover
        return


def _override_get_db() -> Generator[_DummyDB]:
    yield _DummyDB()


def _post(client: TestClient, body: dict[str, Any], user: str = "user_123"):
    import json

    raw = json.dumps(body)
    headers = {
        **signed_headers(
            method="POST",
            path="/internal/telemetry",
            body=raw.encode("utf-8"),
            clerk_user_id=user,
        ),
        "content-type": "application/json",
    }
    return client.post("/internal/telemetry", content=raw, headers=headers)


def test_relays_allowlisted_event(monkeypatch) -> None:
    captured: list[dict[str, Any]] = []
    monkeypatch.setattr(
        telemetry_route,
        "capture_event",
        lambda **kw: captured.append(kw),
    )
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        res = _post(client, {"event": "citation_clicked", "properties": {"hunk_id": "H2"}})
        assert res.status_code == 202
        assert len(captured) == 1
        assert captured[0]["event"] == "citation_clicked"
        assert captured[0]["distinct_id"] == "user_123"
        assert captured[0]["properties"]["hunk_id"] == "H2"
    finally:
        app.dependency_overrides.clear()


def test_rejects_event_outside_allowlist(monkeypatch) -> None:
    captured: list[dict[str, Any]] = []
    monkeypatch.setattr(telemetry_route, "capture_event", lambda **kw: captured.append(kw))
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        # `sign_up` is a real event, but the API observes it itself - the web
        # tier must not be able to forge it.
        res = _post(client, {"event": "sign_up"})
        assert res.status_code == 400
        assert captured == []
    finally:
        app.dependency_overrides.clear()


def test_truncates_oversized_property_values(monkeypatch) -> None:
    captured: list[dict[str, Any]] = []
    monkeypatch.setattr(telemetry_route, "capture_event", lambda **kw: captured.append(kw))
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        res = _post(
            client,
            {"event": "citation_clicked", "properties": {"quote": "x" * 5000}},
        )
        assert res.status_code == 202
        assert len(captured[0]["properties"]["quote"]) == 200
    finally:
        app.dependency_overrides.clear()


def test_rejects_too_many_properties(monkeypatch) -> None:
    monkeypatch.setattr(telemetry_route, "capture_event", lambda **kw: None)
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        res = _post(
            client,
            {"event": "citation_clicked", "properties": {str(i): i for i in range(50)}},
        )
        assert res.status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_unsigned_request_is_rejected() -> None:
    app.dependency_overrides[get_db] = _override_get_db
    try:
        client = TestClient(app)
        res = client.post(
            "/internal/telemetry",
            json={"event": "citation_clicked"},
            headers={"x-clerk-user-id": "user_123"},
        )
        assert res.status_code == 401
    finally:
        app.dependency_overrides.clear()
