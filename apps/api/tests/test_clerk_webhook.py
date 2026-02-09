from __future__ import annotations

import base64
import json
from collections.abc import Generator
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from svix.webhooks import Webhook

from inplain.api.deps import get_db
from inplain.api.main import app
from inplain.api.routes import internal_webhooks as internal_webhooks_route
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import DocumentDocType, JobQueue, JobStatus, NotificationType
from inplain.db.models.jobs import Job
from inplain.db.models.notifications import Notification
from inplain.settings import settings


def test_clerk_webhook_user_deleted_purges_user_data(
    db: Session, test_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    SessionLocal = sessionmaker(bind=test_engine, class_=Session, expire_on_commit=False)

    secret = "whsec_" + base64.b64encode(b"test_secret_123").decode("utf-8")
    monkeypatch.setattr(settings, "clerk_webhook_secret", secret)

    clerk_user_id = "user_123"

    entity = Entity(
        slug="acme",
        name="Acme",
        website_url="https://example.com",
        category="test",
        policy_urls={"privacy": "https://example.com/privacy"},
    )
    db.add(entity)
    db.flush()

    doc = Document(
        clerk_user_id=clerk_user_id,
        entity_id=entity.id,
        url="https://example.com/privacy",
        doc_type=DocumentDocType.privacy,
        next_check_at=datetime.now(UTC),
    )
    db.add(doc)
    db.flush()

    db.add(
        Job(
            queue=JobQueue.fetch,
            clerk_user_id=clerk_user_id,
            document_id=doc.id,
            status=JobStatus.queued,
            run_at=datetime.now(UTC),
        )
    )
    db.add(
        Notification(
            clerk_user_id=clerk_user_id,
            type=NotificationType.system,
            title="Hello",
            body="World",
            payload={"x": 1},
        )
    )
    db.commit()

    def _override_get_db() -> Generator[Session]:
        with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        now = datetime.now(UTC)
        payload_obj = {"type": "user.deleted", "data": {"id": clerk_user_id}}
        payload_str = json.dumps(payload_obj)
        svix_id = "msg_test_1"
        svix_timestamp = str(int(now.timestamp()))
        svix_signature = Webhook(secret).sign(svix_id, now, payload_str)

        client = TestClient(app)
        resp = client.post(
            "/internal/webhooks/clerk",
            data=payload_str.encode("utf-8"),
            headers={
                "content-type": "application/json",
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            },
        )
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
    finally:
        app.dependency_overrides.clear()

    with SessionLocal() as db:
        remaining_docs = db.execute(
            select(Document).where(Document.clerk_user_id == clerk_user_id)
        ).scalars().all()
        remaining_jobs = (
            db.execute(select(Job).where(Job.clerk_user_id == clerk_user_id)).scalars().all()
        )
        remaining_notifs = db.execute(
            select(Notification).where(Notification.clerk_user_id == clerk_user_id)
        ).scalars().all()

        assert remaining_docs == []
        assert remaining_jobs == []
        assert remaining_notifs == []


def test_clerk_webhook_user_created_emits_signup_event(
    db: Session, test_engine: Engine, monkeypatch: pytest.MonkeyPatch
) -> None:
    SessionLocal = sessionmaker(bind=test_engine, class_=Session, expire_on_commit=False)

    secret = "whsec_" + base64.b64encode(b"test_secret_123").decode("utf-8")
    monkeypatch.setattr(settings, "clerk_webhook_secret", secret)

    captured: list[dict[str, object]] = []

    def _capture_event(**kwargs: object) -> None:
        captured.append(dict(kwargs))

    monkeypatch.setattr(internal_webhooks_route, "capture_event", _capture_event)

    def _override_get_db() -> Generator[Session]:
        with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        now = datetime.now(UTC)
        payload_obj = {"type": "user.created", "data": {"id": "user_abc"}}
        payload_str = json.dumps(payload_obj)
        svix_id = "msg_test_2"
        svix_timestamp = str(int(now.timestamp()))
        svix_signature = Webhook(secret).sign(svix_id, now, payload_str)

        client = TestClient(app)
        resp = client.post(
            "/internal/webhooks/clerk",
            data=payload_str.encode("utf-8"),
            headers={
                "content-type": "application/json",
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            },
        )
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
    finally:
        app.dependency_overrides.clear()

    assert len(captured) == 1
    assert captured[0]["distinct_id"] == "user_abc"
    assert captured[0]["event"] == "sign_up"
