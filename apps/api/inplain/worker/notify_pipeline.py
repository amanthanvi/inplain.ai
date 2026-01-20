from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime

import httpx
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import (
    EmailMode,
    EmailProvider,
    NotificationChannel,
    NotificationStatus,
    Provider,
    ProviderAction,
    SummaryStatus,
)
from inplain.db.models.jobs import Job
from inplain.db.models.notification_preferences import NotificationPreference
from inplain.db.models.notifications import Notification
from inplain.db.models.provider_usage import ProviderUsage
from inplain.db.models.users import User
from inplain.entitlements.service import ensure_entitlement
from inplain.notifications.preferences import (
    EffectiveEmailPreference,
    compute_effective_email_preference,
)
from inplain.notifications.unsubscribe import generate_unsubscribe_token
from inplain.settings import settings

logger = logging.getLogger(__name__)


def run_notify_job(db: Session, job: Job) -> None:
    if not settings.enable_email_notifications:
        return

    if job.document_id is None and job.user_id is None:
        _run_daily_digest(db)
        return

    if job.document_id is None or job.user_id is None:
        raise RuntimeError("notify job missing user_id or document_id")

    if not settings.postmark_server_token or not settings.postmark_from_email:
        raise RuntimeError("postmark not configured")
    if not settings.unsubscribe_secret:
        raise RuntimeError("unsubscribe not configured")
    if not settings.web_base_url or not settings.api_public_base_url:
        raise RuntimeError("base urls not configured")

    doc = db.execute(select(Document).where(Document.id == job.document_id)).scalar_one_or_none()
    if doc is None or doc.deleted_at is not None:
        return

    user = db.execute(select(User).where(User.id == job.user_id)).scalar_one_or_none()
    if user is None:
        return

    change_event = _next_change_event_to_notify(db, user_id=user.id, document_id=doc.id)
    if change_event is None:
        return

    pref = _effective_notification_preference(db, user_id=user.id, document_id=doc.id)
    if not pref.email_enabled:
        _write_suppressed_notification(db, user, change_event, reason="unsubscribed")
        return

    if pref.email_mode == EmailMode.daily_digest:
        return

    entitlement = ensure_entitlement(db, user.id)
    email_limit = entitlement.limits.get("email_notifications_max_per_month")
    if isinstance(email_limit, int):
        now = datetime.now(UTC)
        used = db.execute(
            select(func.coalesce(func.sum(ProviderUsage.quantity), 0))
            .where(
                ProviderUsage.user_id == user.id,
                ProviderUsage.provider == Provider.postmark,
                ProviderUsage.action == ProviderAction.email_send,
                ProviderUsage.period_key == now.strftime("%Y-%m"),
            )
            .limit(1)
        ).scalar_one()
        if isinstance(used, int) and used >= email_limit:
            _write_suppressed_notification(db, user, change_event, reason="quota_exceeded")
            return

    to_email = user.email
    subject, body = _render_email(user=user, doc=doc, event=change_event)

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
                Notification.status.in_(
                    [
                        NotificationStatus.sent,
                        NotificationStatus.suppressed_unsubscribed,
                    ]
                ),
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


def _effective_notification_preference(
    db: Session, *, user_id, document_id
) -> EffectiveEmailPreference:
    global_pref_row = (
        db.execute(
            select(NotificationPreference)
            .where(
                NotificationPreference.user_id == user_id,
                NotificationPreference.document_id.is_(None),
            )
            .order_by(NotificationPreference.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    global_pref = (
        EffectiveEmailPreference(
            email_enabled=global_pref_row.email_enabled,
            email_mode=global_pref_row.email_mode,
        )
        if global_pref_row is not None
        else None
    )

    doc_pref_row = (
        db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user_id,
                NotificationPreference.document_id == document_id,
            )
        )
        .scalars()
        .one_or_none()
    )
    doc_pref = (
        EffectiveEmailPreference(
            email_enabled=doc_pref_row.email_enabled,
            email_mode=doc_pref_row.email_mode,
        )
        if doc_pref_row is not None
        else None
    )

    return compute_effective_email_preference(global_pref=global_pref, document_pref=doc_pref)


@dataclass(frozen=True)
class _DigestItem:
    change_event: ChangeEvent
    document: Document
    entity: Entity


def _run_daily_digest(db: Session) -> None:
    if not settings.enable_daily_digest:
        return

    if not settings.postmark_server_token or not settings.postmark_from_email:
        raise RuntimeError("postmark not configured")
    if not settings.unsubscribe_secret:
        raise RuntimeError("unsubscribe not configured")
    if not settings.web_base_url or not settings.api_public_base_url:
        raise RuntimeError("base urls not configured")

    now = datetime.now(UTC)

    user_ids = list(
        db.execute(
            select(Document.user_id)
            .join(ChangeEvent, ChangeEvent.document_id == Document.id)
            .outerjoin(
                Notification,
                and_(
                    Notification.user_id == Document.user_id,
                    Notification.change_event_id == ChangeEvent.id,
                    Notification.status.in_(
                        [
                            NotificationStatus.sent,
                            NotificationStatus.suppressed_unsubscribed,
                        ]
                    ),
                ),
            )
            .where(
                Document.deleted_at.is_(None),
                ChangeEvent.summary_status.in_(
                    [
                        SummaryStatus.completed,
                        SummaryStatus.failed,
                        SummaryStatus.skipped_quota,
                    ]
                ),
                Notification.id.is_(None),
            )
            .distinct()
            .order_by(Document.user_id.asc())
            .limit(200)
        ).scalars()
    )

    for user_id in user_ids:
        try:
            _send_digest_for_user(db, user_id=user_id, now=now)
        except Exception:
            db.rollback()
            logger.exception("daily digest failed for user_id=%s", user_id)


def _send_digest_for_user(db: Session, *, user_id, now: datetime) -> None:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        return

    entitlement = ensure_entitlement(db, user.id)
    allowed = entitlement.limits.get("email_notifications") == "immediate_and_daily_digest"
    if not allowed:
        return

    global_pref_row = (
        db.execute(
            select(NotificationPreference)
            .where(
                NotificationPreference.user_id == user.id,
                NotificationPreference.document_id.is_(None),
            )
            .order_by(NotificationPreference.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )
    global_pref = (
        EffectiveEmailPreference(
            email_enabled=global_pref_row.email_enabled,
            email_mode=global_pref_row.email_mode,
        )
        if global_pref_row is not None
        else None
    )
    if global_pref is not None and global_pref.email_enabled is False:
        _suppress_pending_notifications_for_user(db, user=user, now=now)
        return

    rows = list(
        db.execute(
            select(ChangeEvent, Document, Entity)
            .join(Document, ChangeEvent.document_id == Document.id)
            .join(Entity, Document.entity_id == Entity.id)
            .outerjoin(
                Notification,
                and_(
                    Notification.user_id == user.id,
                    Notification.change_event_id == ChangeEvent.id,
                    Notification.status.in_(
                        [
                            NotificationStatus.sent,
                            NotificationStatus.suppressed_unsubscribed,
                        ]
                    ),
                ),
            )
            .where(
                Document.user_id == user.id,
                Document.deleted_at.is_(None),
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
            .limit(50)
        ).all()
    )

    if not rows:
        return

    doc_ids = [doc.id for _, doc, _ in rows]
    prefs = list(
        db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.id,
                NotificationPreference.document_id.in_(doc_ids),
            )
        )
        .scalars()
        .all()
    )
    prefs_by_doc = {
        p.document_id: EffectiveEmailPreference(
            email_enabled=p.email_enabled,
            email_mode=p.email_mode,
        )
        for p in prefs
        if p.document_id is not None
    }

    items: list[_DigestItem] = []
    for event, doc, ent in rows:
        doc_pref = prefs_by_doc.get(doc.id)
        effective = compute_effective_email_preference(
            global_pref=global_pref,
            document_pref=doc_pref,
        )
        if not effective.email_enabled:
            continue
        if effective.email_mode != EmailMode.daily_digest:
            continue
        items.append(_DigestItem(change_event=event, document=doc, entity=ent))

    if not items:
        return

    subject, body = _render_daily_digest_email(user=user, items=items)
    message_id = _postmark_send(to_email=user.email, subject=subject, body=body)

    sent_at = datetime.now(UTC)
    for item in items:
        db.add(
            Notification(
                user_id=user.id,
                change_event_id=item.change_event.id,
                channel=NotificationChannel.email,
                status=NotificationStatus.sent,
                to_email=user.email,
                provider=EmailProvider.postmark,
                provider_message_id=message_id,
                error=None,
                sent_at=sent_at,
            )
        )

    db.add(
        ProviderUsage(
            user_id=user.id,
            document_id=None,
            provider=Provider.postmark,
            action=ProviderAction.email_send,
            quantity=1,
            tokens_in=None,
            tokens_out=None,
            cost_usd_micros=None,
            period_key=sent_at.strftime("%Y-%m"),
        )
    )

    db.commit()


def _suppress_pending_notifications_for_user(db: Session, *, user: User, now: datetime) -> None:
    pending = list(
        db.execute(
            select(ChangeEvent)
            .join(Document, ChangeEvent.document_id == Document.id)
            .outerjoin(
                Notification,
                and_(
                    Notification.user_id == user.id,
                    Notification.change_event_id == ChangeEvent.id,
                    Notification.status.in_(
                        [
                            NotificationStatus.sent,
                            NotificationStatus.suppressed_unsubscribed,
                        ]
                    ),
                ),
            )
            .where(
                Document.user_id == user.id,
                Document.deleted_at.is_(None),
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
            .limit(200)
        ).scalars()
    )

    for ev in pending:
        db.add(
            Notification(
                user_id=user.id,
                change_event_id=ev.id,
                channel=NotificationChannel.email,
                status=NotificationStatus.suppressed_unsubscribed,
                to_email=user.email,
                provider=EmailProvider.postmark,
                provider_message_id=None,
                error="unsubscribed",
                sent_at=None,
            )
        )

    db.commit()


def _render_daily_digest_email(
    *, user: User, items: list[_DigestItem]
) -> tuple[str, str]:
    if not settings.web_base_url or not settings.api_public_base_url:
        raise RuntimeError("base urls not configured")

    secret = settings.unsubscribe_secret
    if not secret:
        raise RuntimeError("unsubscribe not configured")

    token = generate_unsubscribe_token(user.id, secret=secret)
    unsubscribe_link = f"{settings.api_public_base_url.rstrip('/')}/v1/unsubscribe?token={token}"

    grouped: dict[str, list[_DigestItem]] = defaultdict(list)
    for item in items:
        grouped[item.entity.name].append(item)

    company_count = len(grouped)
    subject = f"[Inplain] Daily digest — {len(items)} change(s)"

    lines: list[str] = []
    lines.append("Inplain daily digest")
    lines.append("")
    lines.append(f"{len(items)} policy change(s) across {company_count} compan(ies).")
    lines.append("")

    for entity_name in sorted(grouped.keys()):
        lines.append(entity_name)
        for item in grouped[entity_name]:
            event = item.change_event
            doc = item.document
            when = event.created_at.astimezone(UTC).strftime("%Y-%m-%d %H:%M UTC")
            link = f"{settings.web_base_url.rstrip('/')}/app/change-events/{event.id}"
            lines.append(f"- {doc.doc_type.value.capitalize()} updated · {when}")
            lines.append(f"  {link}")
        lines.append("")

    lines.append("This summary is informational and not legal advice.")
    lines.append("")
    lines.append(f"Unsubscribe: {unsubscribe_link}")
    lines.append(f"Manage notifications: {settings.web_base_url.rstrip('/')}/app/settings")

    return subject, "\n".join(lines).strip() + "\n"


def _write_suppressed_notification(
    db: Session,
    user: User,
    event: ChangeEvent,
    *,
    reason: str,
) -> None:
    status_value = (
        NotificationStatus.suppressed_unsubscribed
        if reason == "unsubscribed"
        else NotificationStatus.failed
    )
    notification = Notification(
        user_id=user.id,
        change_event_id=event.id,
        channel=NotificationChannel.email,
        status=status_value,
        to_email=user.email,
        provider=EmailProvider.postmark,
        provider_message_id=None,
        error=reason,
        sent_at=None,
    )
    db.add(notification)
    db.commit()


def _render_email(*, user: User, doc: Document, event: ChangeEvent) -> tuple[str, str]:
    subject = f"[Inplain] {doc.doc_type.value.capitalize()} policy updated"
    event_link = f"{settings.web_base_url.rstrip('/')}/app/change-events/{event.id}"

    secret = settings.unsubscribe_secret
    if not secret:
        raise RuntimeError("unsubscribe not configured")

    token = generate_unsubscribe_token(user.id, secret=secret)
    unsubscribe_link = (
        f"{settings.api_public_base_url.rstrip('/')}/v1/unsubscribe?token={token}"
    )

    lines: list[str] = []
    lines.append(f"URL: {doc.url}")
    lines.append(f"View: {event_link}")
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
    lines.append(f"Unsubscribe: {unsubscribe_link}")
    lines.append(f"Manage notifications: {settings.web_base_url.rstrip('/')}/app/settings")

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
