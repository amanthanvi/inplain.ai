from __future__ import annotations

import hashlib
from collections.abc import Generator
from datetime import UTC, datetime, timedelta

from conftest import signed_headers
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from inplain.api.deps import get_db
from inplain.api.main import app
from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import (
    DiffClassification,
    DocumentDocType,
    DocumentStatus,
    ScheduleTier,
    SummaryStatus,
)
from inplain.db.models.snapshots import Snapshot


def _make_client(engine: Engine) -> TestClient:
    SessionLocal = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)

    def _override_get_db() -> Generator[Session]:
        with SessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    return TestClient(app)


def test_export_respects_limit(db: Session, test_engine: Engine) -> None:
    now = datetime.now(UTC)

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
        clerk_user_id="user_123",
        entity_id=entity.id,
        url="https://example.com/privacy",
        doc_type=DocumentDocType.privacy,
        status=DocumentStatus.active,
        schedule_tier=ScheduleTier.daily,
        next_check_at=now,
    )
    db.add(doc)
    db.flush()

    for i in range(12):
        from_text = f"v{i} old"
        to_text = f"v{i} new"

        from_snapshot = Snapshot(
            document_id=doc.id,
            fetched_at=now - timedelta(minutes=100 + i),
            fetch_method="http",
            http_status=200,
            content_type="text/html",
            extracted_text=from_text,
            extracted_sha256=hashlib.sha256(from_text.encode("utf-8")).hexdigest(),
            byte_size_extracted=len(from_text.encode("utf-8")),
            retention_delete_at=now + timedelta(days=90),
        )
        to_snapshot = Snapshot(
            document_id=doc.id,
            fetched_at=now - timedelta(minutes=99 + i),
            fetch_method="http",
            http_status=200,
            content_type="text/html",
            extracted_text=to_text,
            extracted_sha256=hashlib.sha256(to_text.encode("utf-8")).hexdigest(),
            byte_size_extracted=len(to_text.encode("utf-8")),
            retention_delete_at=now + timedelta(days=90),
        )
        db.add_all([from_snapshot, to_snapshot])
        db.flush()

        diff = Diff(
            document_id=doc.id,
            from_snapshot_id=from_snapshot.id,
            to_snapshot_id=to_snapshot.id,
            diff_hunks=[
                {
                    "hunkId": f"h{i + 1}",
                    "contextBefore": "",
                    "contextAfter": "",
                    "added": [to_text],
                    "removed": [from_text],
                }
            ],
            change_score=0.5,
            change_classification=DiffClassification.meaningful,
            created_at=now - timedelta(minutes=i),
        )
        db.add(diff)
        db.flush()

        ce = ChangeEvent(
            document_id=doc.id,
            diff_id=diff.id,
            title=f"Privacy Policy updated {i}",
            summary_status=SummaryStatus.completed,
            summary_what_changed=[{"text": "changed", "citations": []}],
            summary_why_matters=[{"text": "matters", "citations": []}],
            summary_model="test",
            summary_prompt_version=1,
            summary_error=None,
            created_at=now - timedelta(minutes=i),
        )
        db.add(ce)

    db.commit()

    client = _make_client(test_engine)
    try:
        path = "/internal/export?limit_change_events=10"
        headers = {
            **signed_headers(method="GET", path=path),
            "x-clerk-user-id": "user_123",
        }

        resp = client.get(path, headers=headers)
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["limit_change_events"] == 10
        assert payload["truncated"] is True
        assert len(payload["change_events"]) == 10
        assert len(payload["documents"]) == 1
        assert len(payload["entities"]) == 1

        detail = payload["change_events"][0]
        assert "change_event" in detail
        assert "diff" in detail
    finally:
        app.dependency_overrides.clear()
