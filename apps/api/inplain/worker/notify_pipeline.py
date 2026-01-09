from __future__ import annotations

from datetime import UTC, datetime

import httpx
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.documents import Document
from inplain.db.models.enums import (
    EmailProvider,
    NotificationChannel,
    NotificationStatus,
    Provider,
    ProviderAction,
    SummaryStatus,
)
from inplain.db.models.jobs import Job
from inplain.db.models.notifications import Notification
from inplain.db.models.provider_usage import ProviderUsage
from inplain.db.models.users import User
from inplain.settings import settings


def run_notify_job(db: Session, job: Job) -> None:
    if job.document_id is None or job.user_id is None:
        raise RuntimeError("notify job missing user_id or document_id")

    if not settings.postmark_server_token or not settings.postmark_from_email:
        raise RuntimeError("postmark not configured")

    doc = db.execute(select(Document).where(Document.id == job.document_id)).scalar_one_or_none()
    if doc is None or doc.deleted_at is not None:
        return

    user = db.execute(select(User).where(User.id == job.user_id)).scalar_one_or_none()
    if user is None:
        return

    change_event = _next_change_event_to_notify(db, user_id=user.id, document_id=doc.id)
    if change_event is None:
        return

    to_email = user.email
    subject, body = _render_email(doc=doc, event=change_event)

    notification = Notification(
        user_id=user.id,
        change_event_id=change_event.id,
        channel=NotificationChannel.email,
        status=NotificationStatus.queued,
        to_email=to_email,
        provider=EmailProvider.postmark,
        provider_message_id=None,
        error=None,
        sent_at=None,
    )
    db.add(notification)
    db.flush()

    try:
        message_id = _postmark_send(to_email=to_email, subject=subject, body=body)
    except Exception as e:
        notification.status = NotificationStatus.failed
        notification.error = str(e)
        db.add(notification)
        db.commit()
        return

    notification.status = NotificationStatus.sent
    notification.provider_message_id = message_id
    notification.sent_at = datetime.now(UTC)
    db.add(notification)

    now = datetime.now(UTC)
    db.add(
        ProviderUsage(
            user_id=user.id,
            document_id=doc.id,
            provider=Provider.postmark,
            action=ProviderAction.email_send,
            quantity=1,
            tokens_in=None,
            tokens_out=None,
            cost_usd_micros=None,
            period_key=now.strftime("%Y-%m"),
        )
    )

    db.commit()


def _next_change_event_to_notify(
    db: Session, *, user_id, document_id
) -> ChangeEvent | None:
    stmt = (
        select(ChangeEvent)
        .outerjoin(
            Notification,
            and_(
                Notification.user_id == user_id,
                Notification.change_event_id == ChangeEvent.id,
            ),
        )
        .where(
            ChangeEvent.document_id == document_id,
            ChangeEvent.summary_status.in_(
                [
                    SummaryStatus.completed,
                    SummaryStatus.failed,
                    SummaryStatus.skipped_quota,
                ]
            ),
            Notification.id.is_(None),
        )
        .order_by(ChangeEvent.created_at.asc())
        .limit(1)
    )
    return db.execute(stmt).scalars().one_or_none()


def _render_email(*, doc: Document, event: ChangeEvent) -> tuple[str, str]:
    subject = f"[Inplain] {doc.doc_type.value.capitalize()} policy updated"

    lines: list[str] = []
    lines.append(f"URL: {doc.url}")
    lines.append("")

    if event.summary_status == SummaryStatus.completed and event.summary_what_changed:
        lines.append("What changed:")
        for b in event.summary_what_changed[:5]:
            text = b.get("text") if isinstance(b, dict) else None
            if text:
                lines.append(f"- {text}")
        lines.append("")

    lines.append(_disclaimer_for_event(event))
    lines.append("")
    lines.append("Manage notifications in the app.")

    return subject, "\n".join(lines)


def _disclaimer_for_event(event: ChangeEvent) -> str:
    if event.summary_disclaimer:
        return event.summary_disclaimer
    return "This summary is informational and not legal advice."


def _postmark_send(*, to_email: str, subject: str, body: str) -> str:
    url = f"{settings.postmark_base_url.rstrip('/')}/email"
    headers = {
        "X-Postmark-Server-Token": settings.postmark_server_token,
        "Content-Type": "application/json",
    }
    payload = {
        "From": settings.postmark_from_email,
        "To": to_email,
        "Subject": subject,
        "TextBody": body,
    }

    with httpx.Client(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
        resp = client.post(url, headers=headers, json=payload)

    if resp.status_code >= 400:
        raise RuntimeError(f"postmark error: status {resp.status_code}")

    data = resp.json()
    msg_id = data.get("MessageID") or data.get("MessageId")
    return str(msg_id) if msg_id else ""

