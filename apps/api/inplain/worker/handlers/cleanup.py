from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from inplain.db.models.documents import Document
from inplain.db.models.enums import ScheduleTier
from inplain.db.models.jobs import Job
from inplain.db.models.snapshots import Snapshot
from inplain.worker.handlers.common import retention_for_schedule

_SNAPSHOT_BATCH_SIZE = 500
_DOCUMENT_BATCH_SIZE = 200


def run_cleanup_job(db: Session, *, job: Job) -> None:
    now = datetime.now(UTC)
    _cleanup_snapshots(db=db, now=now)
    _cleanup_deleted_documents(db=db, now=now)


def _cleanup_snapshots(*, db: Session, now: datetime) -> int:
    stmt = (
        select(Snapshot.id)
        .outerjoin(Document, Document.last_snapshot_id == Snapshot.id)
        .where(Snapshot.retention_delete_at <= now, Document.id.is_(None))
        .order_by(Snapshot.retention_delete_at.asc())
        .limit(_SNAPSHOT_BATCH_SIZE)
    )
    snapshot_ids = list(db.execute(stmt).scalars().all())
    if not snapshot_ids:
        return 0

    res = db.execute(delete(Snapshot).where(Snapshot.id.in_(snapshot_ids)))
    return int(res.rowcount or 0)


def _cleanup_deleted_documents(*, db: Session, now: datetime) -> int:
    deleted = 0
    for tier in (ScheduleTier.daily, ScheduleTier.six_h, ScheduleTier.one_h):
        cutoff = now - retention_for_schedule(tier)
        stmt = (
            select(Document.id)
            .where(
                Document.deleted_at.is_not(None),
                Document.schedule_tier == tier,
                Document.deleted_at <= cutoff,
            )
            .order_by(Document.deleted_at.asc())
            .limit(_DOCUMENT_BATCH_SIZE)
        )
        doc_ids = list(db.execute(stmt).scalars().all())
        if not doc_ids:
            continue

        res = db.execute(delete(Document).where(Document.id.in_(doc_ids)))
        deleted += int(res.rowcount or 0)

    return deleted
