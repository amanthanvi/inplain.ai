from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select

from inplain.db.models.enums import JobStatus, JobType
from inplain.db.models.jobs import Job
from inplain.db.session import SessionLocal
from inplain.worker.celery_app import celery_app
from inplain.worker.fetch_pipeline import run_fetch_job
from inplain.worker.summarize_pipeline import run_summarize_job


@celery_app.task(name="inplain.worker.tasks.run_job")
def run_job(job_id: str) -> None:
    job_uuid = uuid.UUID(job_id)
    now = datetime.now(UTC)

    with SessionLocal() as db:
        job = db.execute(select(Job).where(Job.id == job_uuid)).scalar_one_or_none()
        if job is None:
            return

        if job.status in {JobStatus.succeeded, JobStatus.dead}:
            return

        job.attempt += 1
        job.status = JobStatus.running
        job.started_at = now
        job.error = None
        db.add(job)
        db.commit()

        try:
            match job.job_type:
                case JobType.fetch:
                    run_fetch_job(db, job)
                case JobType.summarize:
                    run_summarize_job(db, job)
                case _:
                    raise NotImplementedError(f"job type not implemented: {job.job_type.value}")
        except Exception as e:
            job.error = str(e)
            job.status = JobStatus.dead if job.attempt >= job.max_attempts else JobStatus.failed
            job.finished_at = datetime.now(UTC)
            db.add(job)
            db.commit()
            return

        job.status = JobStatus.succeeded
        job.finished_at = datetime.now(UTC)
        db.add(job)
        db.commit()
