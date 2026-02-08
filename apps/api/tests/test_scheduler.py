from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import (
    DocumentDocType,
    DocumentStatus,
    JobQueue,
    JobStatus,
    ScheduleTier,
)
from inplain.db.models.jobs import Job
from inplain.worker.scheduler import schedule_due_documents


def _seed_doc(db: Session, *, status: DocumentStatus, schedule_tier: ScheduleTier) -> Document:
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
        status=status,
        schedule_tier=schedule_tier,
        next_check_at=datetime.now(UTC) - timedelta(seconds=1),
    )
    db.add(doc)
    db.commit()
    return doc


def test_schedule_due_documents_enqueues_fetch_and_updates_next_check(db: Session) -> None:
    doc = _seed_doc(db, status=DocumentStatus.active, schedule_tier=ScheduleTier.daily)
    now = datetime.now(UTC)

    scheduled = schedule_due_documents(db=db, now=now)
    assert scheduled == 1

    job = db.execute(
        select(Job).where(Job.queue == JobQueue.fetch, Job.document_id == doc.id)
    ).scalar_one()
    assert job.status == JobStatus.queued

    refreshed = db.execute(select(Document).where(Document.id == doc.id)).scalar_one()
    assert refreshed.next_check_at == now + timedelta(days=1)


def test_schedule_due_documents_dedupes_existing_fetch_job(db: Session) -> None:
    doc = _seed_doc(db, status=DocumentStatus.active, schedule_tier=ScheduleTier.daily)
    now = datetime.now(UTC)
    db.add(
        Job(
            queue=JobQueue.fetch,
            clerk_user_id=doc.clerk_user_id,
            document_id=doc.id,
            status=JobStatus.queued,
            run_at=now,
        )
    )
    db.commit()

    scheduled = schedule_due_documents(db=db, now=now)
    assert scheduled == 0

