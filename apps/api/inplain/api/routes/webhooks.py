from __future__ import annotations

from datetime import UTC, datetime

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from svix.webhooks import Webhook, WebhookVerificationError

from inplain.auth.clerk import update_user_public_metadata
from inplain.db.models.documents import Document
from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import (
    DocumentStatus,
    Plan,
    ScheduleTier,
    WebhookSource,
    WebhookStatus,
)
from inplain.db.models.users import User
from inplain.db.models.webhook_events import WebhookEvent
from inplain.db.session import get_db
from inplain.entitlements.defaults import default_limits
from inplain.entitlements.limits import schedule_tier_allowed
from inplain.entitlements.service import ensure_entitlement
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


@router.post("/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not settings.stripe_webhook_secret or not settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "error": {
                    "code": "WEBHOOK_NOT_CONFIGURED",
                    "message": "Stripe webhook secret not configured.",
                }
            },
        )
    if not settings.clerk_secret_key:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "error": {
                    "code": "WEBHOOK_NOT_CONFIGURED",
                    "message": "Clerk secret key not configured (required for entitlement sync).",
                }
            },
        )

    payload_bytes = await request.body()
    sig_header = request.headers.get("stripe-signature")
    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_SIGNATURE",
                    "message": "Missing Stripe-Signature header.",
                }
            },
        )

    stripe.api_key = settings.stripe_secret_key

    try:
        evt = stripe.Webhook.construct_event(
            payload_bytes, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_SIGNATURE",
                    "message": "Invalid webhook signature.",
                }
            },
        )

    evt_dict = evt.to_dict()
    external_id = str(evt_dict.get("id") or "unknown")
    received_at = datetime.now(UTC)

    webhook_event = WebhookEvent(
        source=WebhookSource.stripe,
        external_id=external_id,
        received_at=received_at,
        processed_at=None,
        status=WebhookStatus.received,
        payload=evt_dict,
        error=None,
    )
    db.add(webhook_event)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        return {"ok": True}

    try:
        _apply_stripe_event(db, evt_dict)
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


def _apply_stripe_event(db: Session, evt: dict) -> None:
    evt_type = evt.get("type")
    obj = (evt.get("data") or {}).get("object") or {}
    if not isinstance(obj, dict):
        return

    if evt_type == "checkout.session.completed":
        _apply_stripe_checkout_completed(db, obj)
        return

    if evt_type and evt_type.startswith("customer.subscription."):
        _apply_stripe_subscription(db, obj, evt_type)


def _apply_stripe_checkout_completed(db: Session, session: dict) -> None:
    customer_id = session.get("customer")
    clerk_user_id = session.get("client_reference_id") or (session.get("metadata") or {}).get(
        "clerk_user_id"
    )
    if not isinstance(customer_id, str) or not customer_id:
        return
    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        return

    user = (
        db.execute(select(User).where(User.clerk_user_id == clerk_user_id)).scalars().one_or_none()
    )
    if user is None:
        return

    if user.stripe_customer_id != customer_id:
        user.stripe_customer_id = customer_id
        db.add(user)


def _apply_stripe_subscription(db: Session, subscription: dict, evt_type: str) -> None:
    customer_id = subscription.get("customer")
    if not isinstance(customer_id, str) or not customer_id:
        return

    user = (
        db.execute(select(User).where(User.stripe_customer_id == customer_id))
        .scalars()
        .one_or_none()
    )
    if user is None:
        return

    if evt_type == "customer.subscription.deleted":
        _set_user_plan(db, user, Plan.free, period_start_at=None, period_end_at=None)
        return

    status_value = subscription.get("status")
    if status_value not in {"active", "trialing"}:
        _set_user_plan(db, user, Plan.free, period_start_at=None, period_end_at=None)
        return

    plan = _plan_from_subscription(subscription)
    if plan is None:
        return

    period_start_at = _ts_to_dt(subscription.get("current_period_start"))
    period_end_at = _ts_to_dt(subscription.get("current_period_end"))
    _set_user_plan(db, user, plan, period_start_at=period_start_at, period_end_at=period_end_at)


def _plan_from_subscription(subscription: dict) -> Plan | None:
    items = (subscription.get("items") or {}).get("data") or []
    if not isinstance(items, list) or not items:
        return None

    first = items[0] if isinstance(items[0], dict) else {}
    price = first.get("price") or {}
    price_id = price.get("id") if isinstance(price, dict) else None
    if not isinstance(price_id, str) or not price_id:
        return None

    if settings.stripe_price_id_business and price_id == settings.stripe_price_id_business:
        return Plan.business
    if settings.stripe_price_id_pro and price_id == settings.stripe_price_id_pro:
        return Plan.pro

    return None


def _set_user_plan(
    db: Session,
    user: User,
    plan: Plan,
    *,
    period_start_at: datetime | None,
    period_end_at: datetime | None,
) -> None:
    entitlement = ensure_entitlement(db, user.id)
    entitlement.plan = plan
    entitlement.limits = default_limits(plan)
    entitlement.period_start_at = period_start_at
    entitlement.period_end_at = period_end_at
    db.add(entitlement)

    update_user_public_metadata(
        user.clerk_user_id,
        {
            "plan": plan.value,
            "limits": entitlement.limits,
            "period_end_at": period_end_at.isoformat() if period_end_at else None,
        },
    )

    _enforce_plan_on_documents(db, user, entitlement.limits)


def _enforce_plan_on_documents(db: Session, user: User, limits: dict) -> None:
    doc_limit = limits.get("tracked_documents")
    max_frequency = limits.get("schedule_frequency")

    docs = list(
        db.execute(
            select(Document).where(Document.user_id == user.id, Document.deleted_at.is_(None))
        )
        .scalars()
        .all()
    )

    if isinstance(max_frequency, str):
        if max_frequency == "daily":
            allowed_tier = ScheduleTier.daily
        elif max_frequency == "6h":
            allowed_tier = ScheduleTier.six_h
        elif max_frequency == "1h":
            allowed_tier = ScheduleTier.one_h
        else:
            allowed_tier = None

        if allowed_tier is not None:
            for doc in docs:
                if schedule_tier_allowed(max_frequency, doc.schedule_tier):
                    continue
                doc.schedule_tier = allowed_tier
                db.add(doc)

    if isinstance(doc_limit, int) and doc_limit >= 0:
        ordered = sorted(docs, key=lambda d: d.created_at)
        if len(ordered) > doc_limit:
            to_pause = ordered[: len(ordered) - doc_limit]
            for doc in to_pause:
                doc.status = DocumentStatus.paused
                db.add(doc)


def _ts_to_dt(ts: object) -> datetime | None:
    if isinstance(ts, int):
        return datetime.fromtimestamp(ts, tz=UTC)
    if isinstance(ts, float):
        return datetime.fromtimestamp(int(ts), tz=UTC)
    return None
