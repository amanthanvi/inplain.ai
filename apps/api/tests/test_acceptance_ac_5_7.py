from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import (
    DocumentDocType,
    DocumentStatus,
    JobQueue,
    JobStatus,
)
from inplain.db.models.jobs import Job
from inplain.worker.handlers.common import RobotsDecision
from inplain.worker.handlers.fetch import run_fetch_job
from inplain.worker.jobs import claim_jobs, mark_failed


def _seed_doc(db: Session) -> tuple[Entity, Document]:
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
        next_check_at=datetime.now(UTC),
    )
    db.add(doc)
    db.flush()
    return entity, doc


def test_ac_5_404_sets_document_paused(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    from inplain.worker.handlers import fetch as fetch_handler

    _, doc = _seed_doc(db)
    job = Job(
        queue=JobQueue.fetch,
        clerk_user_id=doc.clerk_user_id,
        document_id=doc.id,
        status=JobStatus.queued,
        run_at=datetime.now(UTC),
    )
    db.add(job)
    db.commit()

    monkeypatch.setattr(fetch_handler, "validate_public_http_url", lambda _url: None)
    monkeypatch.setattr(fetch_handler, "enforce_politeness_delay", lambda _url: None)
    monkeypatch.setattr(fetch_handler, "check_robots", lambda _url: RobotsDecision(True, None))

    def fake_http_fetch(*_args: object, **_kwargs: object) -> fetch_handler._FetchResult:
        return fetch_handler._FetchResult(
            http_status=404,
            content_type="text/html",
            content_bytes=b"",
            etag=None,
            last_modified=None,
        )

    monkeypatch.setattr(fetch_handler, "_http_fetch", fake_http_fetch)

    run_fetch_job(db=db, job=db.execute(select(Job).where(Job.id == job.id)).scalar_one())
    db.commit()

    refreshed = db.execute(select(Document).where(Document.id == doc.id)).scalar_one()
    assert refreshed.status == DocumentStatus.paused
    assert refreshed.pause_reason == "url_inaccessible"


def test_ac_6_robots_disallow_sets_blocked_and_rule(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    from inplain.worker.handlers import fetch as fetch_handler

    _, doc = _seed_doc(db)
    job = Job(
        queue=JobQueue.fetch,
        clerk_user_id=doc.clerk_user_id,
        document_id=doc.id,
        status=JobStatus.queued,
        run_at=datetime.now(UTC),
    )
    db.add(job)
    db.commit()

    monkeypatch.setattr(fetch_handler, "validate_public_http_url", lambda _url: None)
    monkeypatch.setattr(
        fetch_handler,
        "check_robots",
        lambda _url: RobotsDecision(allowed=False, rule="Disallow: /privacy"),
    )

    run_fetch_job(db=db, job=db.execute(select(Job).where(Job.id == job.id)).scalar_one())
    db.commit()

    refreshed = db.execute(select(Document).where(Document.id == doc.id)).scalar_one()
    assert refreshed.status == DocumentStatus.blocked_robots
    assert refreshed.robots_rule == "Disallow: /privacy"


def test_ac_7_fetch_fails_5_times_job_is_dead(db: Session, monkeypatch: pytest.MonkeyPatch) -> None:
    from inplain.worker.handlers import fetch as fetch_handler

    _, doc = _seed_doc(db)
    job = Job(
        queue=JobQueue.fetch,
        clerk_user_id=doc.clerk_user_id,
        document_id=doc.id,
        status=JobStatus.queued,
        run_at=datetime.now(UTC),
        max_attempts=5,
    )
    db.add(job)
    db.commit()

    def always_fail(_url: str) -> None:
        raise ValueError("boom")

    monkeypatch.setattr(fetch_handler, "validate_public_http_url", always_fail)

    for _ in range(5):
        claimed = claim_jobs(db=db, queue=JobQueue.fetch, limit=1)
        assert claimed, "expected job to be claimable"
        claimed_job = claimed[0]

        try:
            run_fetch_job(db=db, job=claimed_job)
        except Exception as exc:  # noqa: BLE001
            mark_failed(db=db, job_id=claimed_job.id, error=str(exc), base_delay_seconds=0)

    final = db.execute(select(Job).where(Job.id == job.id)).scalar_one()
    assert final.status == JobStatus.dead
    assert final.attempt == 5

    refreshed_doc = db.execute(select(Document).where(Document.id == doc.id)).scalar_one()
    assert refreshed_doc.status == DocumentStatus.error
    assert refreshed_doc.last_checked_at is not None
