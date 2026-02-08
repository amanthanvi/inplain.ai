from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from inplain.db.models.enums import JobQueue, JobStatus
from inplain.db.models.jobs import Job

_CLAIM_SQL = text(
    """
    WITH claimed AS (
      SELECT id
      FROM jobs
      WHERE queue = :queue
        AND status = 'queued'
        AND run_at <= now()
      ORDER BY created_at
      LIMIT :limit
      FOR UPDATE SKIP LOCKED
    )
    UPDATE jobs
    SET status = 'running',
        locked_at = now(),
        started_at = now(),
        attempt = attempt + 1
    FROM claimed
    WHERE jobs.id = claimed.id
    RETURNING jobs.id
    """
)


def claim_jobs(db: Session, queue: JobQueue, limit: int) -> list[Job]:
    rows = list(db.execute(_CLAIM_SQL, {"queue": queue.value, "limit": limit}).all())
    if not rows:
        db.rollback()
        return []

    job_ids = [r[0] for r in rows]
    jobs = list(db.execute(select(Job).where(Job.id.in_(job_ids))).scalars().all())
    jobs_by_id = {j.id: j for j in jobs}
    db.commit()
    return [jobs_by_id[job_id] for job_id in job_ids if job_id in jobs_by_id]


def mark_succeeded(db: Session, job_id: object) -> None:
    now = datetime.now(UTC)
    db.execute(
        update(Job)
        .where(Job.id == job_id)
        .values(status=JobStatus.succeeded, finished_at=now, locked_at=None)
    )
    db.commit()


def mark_failed(db: Session, job_id: object, error: str, base_delay_seconds: int = 30) -> None:
    now = datetime.now(UTC)
    job = db.execute(select(Job).where(Job.id == job_id)).scalar_one()

    dead = job.attempt >= job.max_attempts
    status = JobStatus.dead if dead else JobStatus.queued

    delay = base_delay_seconds * (2 ** min(job.attempt, 10))
    run_at = job.run_at if dead else now + timedelta(seconds=delay)

    db.execute(
        update(Job)
        .where(Job.id == job_id)
        .values(
            status=status,
            finished_at=now,
            locked_at=None,
            error=error,
            run_at=run_at,
        )
    )
    db.commit()


def cleanup_stale_locks(db: Session, max_age: timedelta) -> int:
    cutoff = datetime.now(UTC) - max_age
    res = db.execute(
        update(Job)
        .where(Job.status == JobStatus.running, Job.locked_at < cutoff)
        .values(status=JobStatus.queued, locked_at=None)
    )
    db.commit()
    return int(res.rowcount or 0)

