from __future__ import annotations

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from inplain.api.deps import get_db
from inplain.api.main import app
from inplain.api.routes import internal_documents as internal_documents_route
from inplain.db.models.entities import Entity
from inplain.db.models.enums import JobQueue, JobStatus
from inplain.db.models.jobs import Job


def _make_client(engine: Engine) -> TestClient:
    SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)

    def _override_get_db() -> Generator[Session]:
        with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


def test_watch_and_check_now_endpoints(db: Session, test_engine: Engine) -> None:
    entity = Entity(
        slug="acme",
        name="Acme",
        website_url="https://example.com",
        category="test",
        policy_urls={
            "privacy": "https://example.com/privacy",
            "tos": "https://example.com/tos",
        },
    )
    db.add(entity)
    db.commit()

    client = _make_client(test_engine)
    try:
        headers = {
            "authorization": "Bearer dev-internal-token",
            "x-clerk-user-id": "user_123",
        }

        watch = client.post(
            "/internal/documents/watch",
            json={"entity_slug": "acme", "schedule_tier": "daily"},
            headers=headers,
        )
        assert watch.status_code == 200
        data = watch.json()
        assert data["entity"]["slug"] == "acme"
        assert len(data["documents"]) == 2

        # Initial watch enqueues fetch jobs.
        with sessionmaker(bind=test_engine, class_=Session, expire_on_commit=False)() as s:
            fetch_jobs = list(
                s.execute(select(Job).where(Job.queue == JobQueue.fetch)).scalars().all()
            )
            assert len(fetch_jobs) == 2
            for j in fetch_jobs:
                j.status = JobStatus.succeeded
                s.add(j)
            s.commit()

            doc_id = str(data["documents"][0]["id"])

        check = client.post(f"/internal/documents/{doc_id}/check-now", headers=headers)
        assert check.status_code == 200
        check_data = check.json()
        assert "job_id" in check_data

        # Usage endpoint counts check-now jobs.
        usage = client.get("/internal/usage", headers=headers)
        assert usage.status_code == 200
        usage_data = usage.json()
        assert usage_data["check_now_used_today"] == 1
    finally:
        app.dependency_overrides.clear()


def test_watch_honors_max_documents_limit(db: Session, test_engine: Engine) -> None:
    first = Entity(
        slug="google",
        name="Google",
        website_url="https://google.com",
        category="search",
        policy_urls={
            "privacy": "https://policies.google.com/privacy",
            "tos": "https://policies.google.com/terms",
        },
    )
    second = Entity(
        slug="apple",
        name="Apple",
        website_url="https://apple.com",
        category="productivity",
        policy_urls={"privacy": "https://apple.com/privacy"},
    )
    third = Entity(
        slug="openai",
        name="OpenAI",
        website_url="https://openai.com",
        category="cloud",
        policy_urls={"privacy": "https://openai.com/policies/privacy-policy"},
    )
    db.add_all([first, second, third])
    db.commit()

    client = _make_client(test_engine)
    try:
        headers = {
            "authorization": "Bearer dev-internal-token",
            "x-clerk-user-id": "user_123",
        }

        watch_google = client.post(
            "/internal/documents/watch",
            json={"entity_slug": "google", "schedule_tier": "daily", "max_documents": 3},
            headers=headers,
        )
        assert watch_google.status_code == 200
        assert len(watch_google.json()["documents"]) == 2

        watch_apple = client.post(
            "/internal/documents/watch",
            json={"entity_slug": "apple", "schedule_tier": "daily", "max_documents": 3},
            headers=headers,
        )
        assert watch_apple.status_code == 200
        assert len(watch_apple.json()["documents"]) == 1

        watch_openai = client.post(
            "/internal/documents/watch",
            json={"entity_slug": "openai", "schedule_tier": "daily", "max_documents": 3},
            headers=headers,
        )
        assert watch_openai.status_code == 409
        payload = watch_openai.json()
        assert payload["error"]["message"] == "document limit exceeded"
    finally:
        app.dependency_overrides.clear()


def test_first_watch_emits_posthog_event(
    db: Session, test_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    entity = Entity(
        slug="acme",
        name="Acme",
        website_url="https://example.com",
        category="test",
        policy_urls={"privacy": "https://example.com/privacy"},
    )
    db.add(entity)
    db.commit()

    captured: list[dict[str, object]] = []

    def _capture_event(**kwargs: object) -> None:
        captured.append(dict(kwargs))

    monkeypatch.setattr(internal_documents_route, "capture_event", _capture_event)

    client = _make_client(test_engine)
    try:
        headers = {
            "authorization": "Bearer dev-internal-token",
            "x-clerk-user-id": "user_123",
        }

        watch = client.post(
            "/internal/documents/watch",
            json={"entity_slug": "acme", "schedule_tier": "daily"},
            headers=headers,
        )
        assert watch.status_code == 200
    finally:
        app.dependency_overrides.clear()

    assert len(captured) == 1
    assert captured[0]["distinct_id"] == "user_123"
    assert captured[0]["event"] == "first_watch"
