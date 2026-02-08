from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import (
    DocumentDocType,
    JobQueue,
    JobStatus,
    RobotsStatus,
    SummaryStatus,
)
from inplain.db.models.jobs import Job
from inplain.db.models.notifications import Notification
from inplain.settings import settings
from inplain.worker.handlers.common import process_extracted_text
from inplain.worker.handlers.diff import run_diff_job
from inplain.worker.handlers.notify import run_notify_job
from inplain.worker.handlers.summarize import run_summarize_job


def test_pipeline_creates_change_event_summary_and_notification(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    now = datetime.now(UTC)

    entity = Entity(
        slug="acme",
        name="Acme",
        website_url="https://example.com",
        category="test",
        policy_urls={"privacy": "https://example.com/privacy"},
    )
    db.add(entity)
    db.flush()

    doc = Document(
        clerk_user_id="user_123",
        entity_id=entity.id,
        url="https://example.com/privacy",
        doc_type=DocumentDocType.privacy,
        next_check_at=now,
    )
    db.add(doc)
    db.flush()

    base = ("We collect email addresses to provide the service.\n" * 30).strip()
    old_text = base
    addition = ("We now share phone numbers with vendors for fraud prevention.\n" * 15).strip()
    new_text = base + "\n" + addition

    process_extracted_text(
        db,
        doc=doc,
        extracted_text=old_text,
        http_status=200,
        content_type="text/plain",
        fetch_method="http",
        now=now,
        robots_status=RobotsStatus.allowed,
        robots_rule=None,
    )
    db.commit()

    process_extracted_text(
        db,
        doc=doc,
        extracted_text=new_text,
        http_status=200,
        content_type="text/plain",
        fetch_method="http",
        now=now,
        robots_status=RobotsStatus.allowed,
        robots_rule=None,
    )
    db.commit()

    diff_job = db.execute(select(Job).where(Job.queue == JobQueue.diff)).scalar_one()
    run_diff_job(db=db, job=diff_job)
    db.commit()

    change_event = db.execute(select(ChangeEvent)).scalar_one()
    diff = db.execute(select(Diff).where(Diff.id == change_event.diff_id)).scalar_one()
    first_hunk = diff.diff_hunks[0]
    hid = str(first_hunk["hunkId"])
    quote = str("".join(first_hunk.get("added") or [])).strip()[:40]
    assert hid
    assert quote

    monkeypatch.setattr(settings, "openrouter_api_key", "test")

    def fake_call_openrouter(*_args: object, **_kwargs: object) -> dict:
        return {
            "what_changed": [
                {"text": "Policy updated", "citations": [{"hunkId": hid, "quote": quote}]}
            ],
            "why_matters": [
                {
                    "text": "This may affect users",
                    "citations": [{"hunkId": hid, "quote": quote}],
                }
            ],
        }

    from inplain.worker.handlers import summarize as summarize_handler

    monkeypatch.setattr(summarize_handler, "_call_openrouter", fake_call_openrouter)

    summarize_job = db.execute(select(Job).where(Job.queue == JobQueue.summarize)).scalar_one()
    run_summarize_job(db=db, job=summarize_job)
    db.commit()

    refreshed = (
        db.execute(select(ChangeEvent).where(ChangeEvent.id == change_event.id)).scalar_one()
    )
    assert refreshed.summary_status == SummaryStatus.completed
    assert refreshed.summary_what_changed
    assert refreshed.summary_why_matters

    notify_job = db.execute(select(Job).where(Job.queue == JobQueue.notify)).scalar_one()
    run_notify_job(
        db=db,
        job_payload=notify_job.payload or {},
        document_id=notify_job.document_id,
    )
    notify_job.status = JobStatus.succeeded
    db.add(notify_job)
    db.commit()

    notifs = list(
        db.execute(select(Notification).where(Notification.clerk_user_id == doc.clerk_user_id))
        .scalars()
        .all()
    )
    assert len(notifs) == 1
