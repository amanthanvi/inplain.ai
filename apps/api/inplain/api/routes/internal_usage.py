from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inplain.api.deps import get_clerk_user_id, get_db
from inplain.api.schemas import UsageOut
from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.documents import Document
from inplain.db.models.enums import JobQueue, JobStatus, SummaryStatus
from inplain.db.models.jobs import Job

router = APIRouter(tags=["internal.usage"])


@router.get("/usage", response_model=UsageOut)
def get_usage(
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> UsageOut:
    now = datetime.now(UTC)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    tracked = db.execute(
        select(func.count(Document.id)).where(
            Document.clerk_user_id == clerk_user_id,
            Document.deleted_at.is_(None),
        )
    ).scalar_one()

    check_now_used_today = db.execute(
        select(func.count(Job.id)).where(
            Job.queue == JobQueue.fetch,
            Job.clerk_user_id == clerk_user_id,
            Job.created_at >= day_start,
            Job.payload["reason"].astext == "check_now",
            Job.status.in_(
                [
                    JobStatus.queued,
                    JobStatus.running,
                    JobStatus.succeeded,
                    JobStatus.failed,
                    JobStatus.dead,
                ]
            ),
        )
    ).scalar_one()

    render_used_month = db.execute(
        select(func.count(Job.id)).where(
            Job.queue == JobQueue.render,
            Job.clerk_user_id == clerk_user_id,
            Job.created_at >= month_start,
            Job.status.in_(
                [
                    JobStatus.queued,
                    JobStatus.running,
                    JobStatus.succeeded,
                    JobStatus.failed,
                    JobStatus.dead,
                ]
            ),
        )
    ).scalar_one()

    summaries_used_month = db.execute(
        select(func.count(ChangeEvent.id))
        .join(Document, Document.id == ChangeEvent.document_id)
        .where(
            Document.clerk_user_id == clerk_user_id,
            ChangeEvent.created_at >= month_start,
            ChangeEvent.summary_status.in_([SummaryStatus.completed, SummaryStatus.failed]),
        )
    ).scalar_one()

    return UsageOut(
        tracked_documents=int(tracked or 0),
        check_now_used_today=int(check_now_used_today or 0),
        render_used_month=int(render_used_month or 0),
        summaries_used_month=int(summaries_used_month or 0),
    )

