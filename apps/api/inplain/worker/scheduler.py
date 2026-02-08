from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import exists, literal, select
from sqlalchemy.orm import Session

from inplain.db.models.documents import Document
from inplain.db.models.enums import DocumentStatus, JobQueue, JobStatus, ScheduleTier
from inplain.db.models.jobs import Job

_SCHEDULE_LIMIT = 200


def schedule_due_documents(db: Session, now: datetime) -> int:
    pending_fetch = (
        select(literal(1))
        .select_from(Job)
        .where(
            Job.queue == JobQueue.fetch,
            Job.status.in_([JobStatus.queued, JobStatus.running]),
            Job.document_id == Document.id,
        )
    )

    stmt = (
        select(Document)
        .where(
            Document.status.in_(
                [DocumentStatus.active, DocumentStatus.blocked_robots, DocumentStatus.error]
            ),
            Document.deleted_at.is_(None),
            Document.next_check_at <= now,
            ~exists(pending_fetch),
        )
        .order_by(Document.next_check_at.asc())
        .limit(_SCHEDULE_LIMIT)
        .with_for_update(skip_locked=True)
    )
    docs = list(db.execute(stmt).scalars().all())
    if not docs:
        db.rollback()
        return 0

    for doc in docs:
        db.add(
            Job(
                queue=JobQueue.fetch,
                clerk_user_id=doc.clerk_user_id,
                document_id=doc.id,
                status=JobStatus.queued,
                run_at=now,
            )
        )
        if doc.status == DocumentStatus.blocked_robots:
            doc.next_check_at = now + timedelta(days=1)
        else:
            doc.next_check_at = now + _schedule_delta(doc.schedule_tier)
        db.add(doc)

    db.commit()
    return len(docs)


def _schedule_delta(tier: ScheduleTier) -> timedelta:
    match tier:
        case ScheduleTier.daily:
            return timedelta(days=1)
        case ScheduleTier.six_h:
            return timedelta(hours=6)
        case ScheduleTier.one_h:
            return timedelta(hours=1)
