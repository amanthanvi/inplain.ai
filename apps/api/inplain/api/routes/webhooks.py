from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from svix.webhooks import Webhook, WebhookVerificationError

from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import Plan, WebhookSource, WebhookStatus
from inplain.db.models.users import User
from inplain.db.models.webhook_events import WebhookEvent
from inplain.db.session import get_db
from inplain.entitlements.defaults import default_limits
from inplain.settings import settings

router = APIRouter(prefix="/v1/webhooks")


@router.post("/clerk")
async def clerk_webhook(request: Request, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not settings.clerk_webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "error": {
                    "code": "WEBHOOK_NOT_CONFIGURED",
                    "message": "Clerk webhook secret not configured.",
                }
            },
        )

    payload_bytes = await request.body()
    headers = {k: v for k, v in request.headers.items()}

    try:
        evt = Webhook(settings.clerk_webhook_secret).verify(payload_bytes, headers)
    except WebhookVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_SIGNATURE",
                    "message": "Invalid webhook signature.",
                }
            },
        )

    external_id = headers.get("svix-id") or str(evt.get("id") or "")
    received_at = datetime.now(UTC)

    webhook_event = WebhookEvent(
        source=WebhookSource.clerk,
        external_id=external_id or "unknown",
        received_at=received_at,
        processed_at=None,
        status=WebhookStatus.received,
        payload=evt,
        error=None,
    )
    db.add(webhook_event)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"ok": True}

    try:
        _apply_clerk_event(db, evt)
        webhook_event.status = WebhookStatus.processed
        webhook_event.processed_at = datetime.now(UTC)
        db.add(webhook_event)
        db.commit()
    except Exception as e:
        db.rollback()
        webhook_event.status = WebhookStatus.failed
        webhook_event.error = str(e)
        db.add(webhook_event)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": {
                    "code": "WEBHOOK_PROCESSING_FAILED",
                    "message": "Webhook processing failed.",
                }
            },
        )

    return {"ok": True}


def _apply_clerk_event(db: Session, evt: dict) -> None:
    evt_type = evt.get("type")
    if evt_type not in {"user.created", "user.updated"}:
        return

    data = evt.get("data") or {}
    if not isinstance(data, dict):
        raise RuntimeError("invalid clerk payload: data is not an object")

    clerk_user_id = data.get("id")
    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        raise RuntimeError("invalid clerk payload: missing user id")

    email = _extract_email_from_user_data(data)
    if not email:
        raise RuntimeError("invalid clerk payload: missing email")

    user = (
        db.execute(select(User).where(User.clerk_user_id == clerk_user_id))
        .scalars()
        .one_or_none()
    )
    if user is None:
        user = User(clerk_user_id=clerk_user_id, email=email)
        db.add(user)
        db.flush()
    else:
        user.email = email
        db.add(user)

    entitlement = (
        db.execute(select(Entitlement).where(Entitlement.user_id == user.id))
        .scalars()
        .one_or_none()
    )
    if entitlement is None:
        entitlement = Entitlement(
            user_id=user.id,
            plan=Plan.free,
            limits=default_limits(Plan.free),
        )
        db.add(entitlement)


def _extract_email_from_user_data(data: dict) -> str | None:
    primary_id = data.get("primary_email_address_id") or data.get("primaryEmailAddressId")
    emails = data.get("email_addresses") or data.get("emailAddresses") or []

    if isinstance(primary_id, str):
        for item in emails:
            if item.get("id") == primary_id and item.get("email_address"):
                return item["email_address"]

    for item in emails:
        email = item.get("email_address")
        if email:
            return email

    return None
