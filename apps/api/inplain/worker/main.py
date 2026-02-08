from __future__ import annotations

import logging
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
        threading.Thread(target=scheduler_loop, name="scheduler", daemon=True),
        threading.Thread(target=stale_lock_loop, name="stale-locks", daemon=True),
    ]
    worker_counts = {
        JobQueue.render: 2,
    }
    for q in JobQueue:
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


if __name__ == "__main__":
    main()
