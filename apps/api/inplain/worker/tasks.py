from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from inplain.db.models.enums import JobStatus
from inplain.db.models.jobs import Job
from inplain.db.session import SessionLocal
from inplain.worker.celery_app import celery_app


@celery_app.task(name="inplain.worker.tasks.run_job")
def run_job(job_id: str) -> None:
    job_uuid = uuid.UUID(job_id)
    now = datetime.now(UTC)

    with SessionLocal() as db:
        job = db.execute(select(Job).where(Job.id == job_uuid)).scalar_one_or_none()
        if job is None:
            return

        job.status = JobStatus.running
        job.started_at = now
        db.add(job)
        db.commit()

        # TODO: route by job.job_type (fetch/render/diff/summarize/notify/cleanup)
        job.status = JobStatus.succeeded
        job.finished_at = datetime.now(UTC)
        db.add(job)
        db.commit()
