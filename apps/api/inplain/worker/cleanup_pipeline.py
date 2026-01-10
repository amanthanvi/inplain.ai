from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.jobs import Job
from inplain.db.models.notifications import Notification
from inplain.db.models.snapshots import Snapshot
from inplain.storage.s3 import delete_object

_BATCH_LIMIT = 500


def run_cleanup_job(db: Session, job: Job) -> None:
    now = datetime.now(UTC)

    while True:
        snapshots = (
            db.execute(
                select(Snapshot)
                .where(Snapshot.retention_delete_at <= now)
                .order_by(Snapshot.retention_delete_at.asc())
                .limit(_BATCH_LIMIT)
                .with_for_update(skip_locked=True)
            )
            .scalars()
            .all()
        )
        if not snapshots:
            return

        affected_document_ids: set = set()

        for snapshot in snapshots:
            affected_document_ids.add(snapshot.document_id)

            if snapshot.raw_storage_key:
                delete_object(key=snapshot.raw_storage_key)

            diff_ids = (
                db.execute(
                    select(Diff.id).where(
                        or_(
                            Diff.from_snapshot_id == snapshot.id,
                            Diff.to_snapshot_id == snapshot.id,
                        )
                    )
                )
                .scalars()
                .all()
            )

            if diff_ids:
                event_ids = (
                    db.execute(select(ChangeEvent.id).where(ChangeEvent.diff_id.in_(diff_ids)))
                    .scalars()
                    .all()
                )
                if event_ids:
                    db.execute(delete(Notification).where(Notification.change_event_id.in_(event_ids)))

                db.execute(delete(ChangeEvent).where(ChangeEvent.diff_id.in_(diff_ids)))
                db.execute(delete(Diff).where(Diff.id.in_(diff_ids)))

            db.delete(snapshot)

        db.commit()
        _recompute_document_pointers(db, affected_document_ids)


def _recompute_document_pointers(db: Session, document_ids: set) -> None:
    for document_id in document_ids:
        last_snapshot_id = (
            db.execute(
                select(Snapshot.id)
                .where(Snapshot.document_id == document_id)
                .order_by(Snapshot.fetched_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )
        last_change_event_id = (
            db.execute(
                select(ChangeEvent.id)
                .where(ChangeEvent.document_id == document_id)
                .order_by(ChangeEvent.created_at.desc())
                .limit(1)
            )
            .scalars()
            .first()
        )

        db.execute(
            update(Document)
            .where(Document.id == document_id)
            .values(last_snapshot_id=last_snapshot_id, last_change_event_id=last_change_event_id)
        )

    db.commit()

