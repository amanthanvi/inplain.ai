from __future__ import annotations

import logging
import os
import threading
import time
from datetime import UTC, datetime, timedelta

from inplain.db.models.enums import JobQueue
from inplain.db.session import SessionLocal
from inplain.worker.executor import execute_job
from inplain.worker.jobs import claim_jobs, cleanup_stale_locks, mark_failed, mark_succeeded
from inplain.worker.scheduler import ensure_cleanup_job, schedule_due_documents


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    enabled_queues = _parse_enabled_queues(os.environ.get("INPLAIN_WORKER_QUEUES"))
    enable_scheduler = _parse_bool_env("INPLAIN_WORKER_ENABLE_SCHEDULER", default=True)
    enable_stale_lock_cleanup = _parse_bool_env(
        "INPLAIN_WORKER_ENABLE_STALE_LOCK_CLEANUP",
        default=True,
    )

    stop_event = threading.Event()

    def scheduler_loop() -> None:
        while not stop_event.is_set():
            now = datetime.now(UTC)
            with SessionLocal() as db:
                scheduled = schedule_due_documents(db=db, now=now)
                if scheduled:
                    logging.info("scheduler scheduled=%s", scheduled)
                if ensure_cleanup_job(db=db, now=now):
                    logging.info("scheduler cleanup=queued")
            stop_event.wait(60)

    def stale_lock_loop() -> None:
        while not stop_event.is_set():
            with SessionLocal() as db:
                cleaned = cleanup_stale_locks(db=db, max_age=timedelta(minutes=10))
                if cleaned:
                    logging.warning("stale locks cleaned=%s", cleaned)
            stop_event.wait(300)

    def worker_loop(queue: JobQueue) -> None:
        while not stop_event.is_set():
            with SessionLocal() as db:
                jobs = claim_jobs(db=db, queue=queue, limit=10)
            if not jobs:
                stop_event.wait(1)
                continue

            for job in jobs:
                try:
                    with SessionLocal() as db:
                        execute_job(db=db, job_id=job.id)
                        mark_succeeded(db=db, job_id=job.id)
                except Exception as exc:  # noqa: BLE001
                    with SessionLocal() as db:
                        mark_failed(db=db, job_id=job.id, error=str(exc))

    threads = [
    ]
    if enable_scheduler:
        threads.append(threading.Thread(target=scheduler_loop, name="scheduler", daemon=True))
    if enable_stale_lock_cleanup:
        threads.append(threading.Thread(target=stale_lock_loop, name="stale-locks", daemon=True))

    worker_counts = {
        JobQueue.render: 2,
    }
    for q in JobQueue:
        if enabled_queues is not None and q not in enabled_queues:
            continue
        for i in range(worker_counts.get(q, 1)):
            threads.append(
                threading.Thread(
                    target=worker_loop,
                    args=(q,),
                    name=f"worker-{q.value}-{i + 1}",
                    daemon=True,
                )
            )

    for t in threads:
        t.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        stop_event.set()
        raise


def _parse_bool_env(key: str, *, default: bool) -> bool:
    raw = os.environ.get(key)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "y", "on")


def _parse_enabled_queues(raw: str | None) -> set[JobQueue] | None:
    if not raw:
        return None

    allowed = {q.value: q for q in JobQueue}
    enabled: set[JobQueue] = set()
    for part in raw.split(","):
        key = part.strip()
        if not key:
            continue
        q = allowed.get(key)
        if q is None:
            raise ValueError(f"Invalid INPLAIN_WORKER_QUEUES entry: {key}")
        enabled.add(q)

    return enabled


if __name__ == "__main__":
    main()
