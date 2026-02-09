#!/usr/bin/env python3
from __future__ import annotations

import argparse
from datetime import UTC, datetime

from sqlalchemy import select

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import DocumentDocType, JobQueue, JobStatus, RobotsStatus, SummaryStatus
from inplain.db.models.jobs import Job
from inplain.db.session import SessionLocal
from inplain.worker.handlers.common import process_extracted_text
from inplain.worker.handlers.diff import run_diff_job
from inplain.worker.handlers.notify import run_notify_job


def _build_demo_texts() -> tuple[str, str]:
    base = (
        "We collect account information, support messages, and usage logs to operate the service. "
        "We use this data for reliability, fraud prevention, and product improvements.\n"
    )
    old_text = (base * 25).strip()
    addition = (
        "We now share limited device identifiers with contracted service providers for abuse "
        "prevention and security analytics.\n"
    )
    new_text = (old_text + "\n" + (addition * 20)).strip()
    return old_text, new_text


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed one demo change event for launch screenshots.")
    parser.add_argument("--user-id", default="demo_user")
    parser.add_argument("--entity-slug", default="google")
    args = parser.parse_args()

    with SessionLocal() as db:
        existing = db.execute(
            select(ChangeEvent.id)
            .join(Document, Document.id == ChangeEvent.document_id)
            .where(Document.clerk_user_id == args.user_id)
            .limit(1)
        ).scalar_one_or_none()
        if existing is not None:
            print(f"Demo change event already exists: {existing}")
            return 0

        entity = db.execute(select(Entity).where(Entity.slug == args.entity_slug)).scalar_one_or_none()
        if entity is None:
            entity = db.execute(select(Entity).order_by(Entity.slug.asc())).scalar_one_or_none()
        if entity is None:
            raise RuntimeError("No entities found. Run migrations and catalog seed first.")

        policy_urls = entity.policy_urls or {}
        privacy_url = policy_urls.get("privacy")
        if not isinstance(privacy_url, str) or not privacy_url:
            privacy_url = next((str(v) for v in policy_urls.values() if isinstance(v, str) and v), "")
        if not privacy_url:
            raise RuntimeError(f"Entity {entity.slug} has no usable policy URL.")

        now = datetime.now(UTC)
        document = Document(
            clerk_user_id=args.user_id,
            entity_id=entity.id,
            url=privacy_url,
            doc_type=DocumentDocType.privacy,
            next_check_at=now,
        )
        db.add(document)
        db.flush()

        old_text, new_text = _build_demo_texts()
        process_extracted_text(
            db,
            doc=document,
            extracted_text=old_text,
            http_status=200,
            content_type="text/html",
            fetch_method="http",
            now=now,
            robots_status=RobotsStatus.allowed,
            robots_rule=None,
        )
        process_extracted_text(
            db,
            doc=document,
            extracted_text=new_text,
            http_status=200,
            content_type="text/html",
            fetch_method="http",
            now=datetime.now(UTC),
            robots_status=RobotsStatus.allowed,
            robots_rule=None,
        )
        db.flush()

        diff_job = db.execute(
            select(Job)
            .where(Job.queue == JobQueue.diff, Job.document_id == document.id)
            .order_by(Job.created_at.desc())
        ).scalar_one()
        run_diff_job(db=db, job=diff_job)
        diff_job.status = JobStatus.succeeded
        db.add(diff_job)
        db.flush()

        change_event = db.execute(
            select(ChangeEvent)
            .where(ChangeEvent.document_id == document.id)
            .order_by(ChangeEvent.created_at.desc())
        ).scalar_one()
        diff = db.execute(select(Diff).where(Diff.id == change_event.diff_id)).scalar_one()

        first_hunk = diff.diff_hunks[0]
        quote = str("".join(first_hunk.get("added") or [])).strip()[:120]
        citations = [{"hunkId": str(first_hunk["hunkId"]), "quote": quote, "status": "valid"}]

        change_event.summary_status = SummaryStatus.completed
        change_event.summary_what_changed = [
            {"text": "Added a new service-provider sharing clause for abuse prevention.", "citations": citations}
        ]
        change_event.summary_why_matters = [
            {"text": "The updated language broadens data-sharing scope for security operations.", "citations": citations}
        ]
        change_event.summary_model = "demo-seed"
        change_event.summary_prompt_version = 1
        change_event.summary_error = None
        db.add(change_event)

        run_notify_job(db=db, job_payload={"change_event_id": str(change_event.id)}, document_id=document.id)
        db.commit()

        print(f"Seeded demo change event: {change_event.id} (entity={entity.slug}, user={args.user_id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
