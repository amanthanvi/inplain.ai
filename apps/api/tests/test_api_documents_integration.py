from __future__ import annotations

from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from inplain.api.deps import get_db
from inplain.api.main import app
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
