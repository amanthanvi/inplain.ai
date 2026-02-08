from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.enums import JobQueue
from inplain.db.models.jobs import Job
from inplain.worker.handlers.cleanup import run_cleanup_job
from inplain.worker.handlers.diff import run_diff_job
from inplain.worker.handlers.fetch import run_fetch_job
from inplain.worker.handlers.notify import run_notify_job
from inplain.worker.handlers.render import run_render_job
from inplain.worker.handlers.summarize import run_summarize_job


def execute_job(db: Session, job_id: object) -> None:
    job = db.execute(select(Job).where(Job.id == job_id)).scalar_one()

    match job.queue:
        case JobQueue.fetch:
            run_fetch_job(db=db, job=job)
        case JobQueue.render:
            run_render_job(db=db, job=job)
        case JobQueue.diff:
            run_diff_job(db=db, job=job)
        case JobQueue.summarize:
            run_summarize_job(db=db, job=job)
        case JobQueue.notify:
            run_notify_job(db=db, job_payload=job.payload or {}, document_id=job.document_id)
        case JobQueue.cleanup:
            run_cleanup_job(db=db, job=job)
        case _:
            raise ValueError(f"unknown queue: {job.queue}")
