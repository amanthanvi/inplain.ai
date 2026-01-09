from __future__ import annotations

import logging
import time
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.documents import Document
from inplain.db.models.enums import DocumentStatus, JobStatus, JobType, ScheduleTier
from inplain.db.models.jobs import Job
from inplain.db.session import SessionLocal
from inplain.settings import settings
from inplain.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

_DEFAULT_INTERVAL_SECONDS = 30
_SCHEDULE_BATCH_LIMIT = 500
_ENQUEUE_BATCH_LIMIT = 500


def run_scheduler_loop() -> None:
    interval = max(
        1,
        int(
            getattr(
                settings,
                "scheduler_interval_seconds",
                _DEFAULT_INTERVAL_SECONDS,
            )
        ),
    )

    while True:
        now = datetime.now(UTC)
        with SessionLocal() as db:
            try:
                scheduled = schedule_due_documents(db, now)
                enqueued = enqueue_pending_jobs(db)
                if scheduled or enqueued:
                    logger.info("scheduler cycle scheduled=%s enqueued=%s", scheduled, enqueued)
            except Exception:
                db.rollback()
                logger.exception("scheduler cycle failed")

        time.sleep(interval)


def schedule_due_documents(db: Session, now: datetime) -> int:
    stmt = (
        select(Document)
        .where(
            Document.status == DocumentStatus.active,
            Document.deleted_at.is_(None),
            Document.next_due_at <= now,
        )
        .order_by(Document.next_due_at.asc())
        .limit(_SCHEDULE_BATCH_LIMIT)
        .with_for_update(skip_locked=True)
    )
    docs = list(db.execute(stmt).scalars().all())
    if not docs:
        return 0

    new_jobs: list[Job] = []
    for doc in docs:
        job = Job(
            user_id=doc.user_id,
            document_id=doc.id,
            job_type=JobType.fetch,
            status=JobStatus.queued,
        )
        db.add(job)
        new_jobs.append(job)

        doc.next_due_at = now + _schedule_delta(doc.schedule_tier)
        db.add(doc)

    db.flush()

    if settings.enqueue_jobs:
        for job in new_jobs:
            async_result = celery_app.send_task(
                "inplain.worker.tasks.run_job",
                args=[str(job.id)],
                queue=_queue_for_job_type(job.job_type),
            )
            job.celery_task_id = async_result.id
            db.add(job)

    db.commit()
    return len(docs)


def enqueue_pending_jobs(db: Session) -> int:
    if not settings.enqueue_jobs:
        return 0

    stmt = (
        select(Job)
        .where(Job.status == JobStatus.queued, Job.celery_task_id.is_(None))
        .order_by(Job.created_at.asc())
        .limit(_ENQUEUE_BATCH_LIMIT)
        .with_for_update(skip_locked=True)
    )
    jobs = list(db.execute(stmt).scalars().all())
    if not jobs:
        return 0

    for job in jobs:
        async_result = celery_app.send_task(
            "inplain.worker.tasks.run_job",
            args=[str(job.id)],
            queue=_queue_for_job_type(job.job_type),
        )
        job.celery_task_id = async_result.id
        db.add(job)

    db.commit()
    return len(jobs)


def _schedule_delta(tier: ScheduleTier) -> timedelta:
    match tier:
        case ScheduleTier.daily:
            return timedelta(days=1)
        case ScheduleTier.six_h:
            return timedelta(hours=6)
        case ScheduleTier.one_h:
            return timedelta(hours=1)


def _queue_for_job_type(job_type: JobType) -> str:
    return job_type.value


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_scheduler_loop()
