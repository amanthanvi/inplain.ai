from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.enums import JobQueue, JobStatus
from inplain.db.models.jobs import Job
from inplain.worker.jobs import claim_jobs


def test_claim_jobs_marks_running_and_increments_attempt(db: Session) -> None:
    now = datetime.now(UTC)
    job = Job(queue=JobQueue.fetch, status=JobStatus.queued, run_at=now)
    db.add(job)
    db.commit()

    claimed = claim_jobs(db=db, queue=JobQueue.fetch, limit=1)
    assert len(claimed) == 1
    assert claimed[0].id == job.id

    refreshed = db.execute(select(Job).where(Job.id == job.id)).scalar_one()
    assert refreshed.status == JobStatus.running
    assert refreshed.attempt == 1
    assert refreshed.locked_at is not None


def test_claim_jobs_respects_run_at(db: Session) -> None:
    future = datetime.now(UTC) + timedelta(minutes=10)
    job = Job(queue=JobQueue.fetch, status=JobStatus.queued, run_at=future)
    db.add(job)
    db.commit()

    claimed = claim_jobs(db=db, queue=JobQueue.fetch, limit=1)
    assert claimed == []

