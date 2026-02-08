from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.enums import JobQueue
from inplain.db.models.jobs import Job
from inplain.worker.handlers.fetch import run_fetch_job


def execute_job(db: Session, job_id: object) -> None:
    job = db.execute(select(Job).where(Job.id == job_id)).scalar_one()

    match job.queue:
        case JobQueue.fetch:
            run_fetch_job(db=db, job=job)
        case _:
            # TODO(v0.1.0): implement remaining queues
            return

