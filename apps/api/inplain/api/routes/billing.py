from __future__ import annotations

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.db.models.enums import Plan
from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.settings import settings

router = APIRouter(prefix="/v1/billing")


class CheckoutSessionIn(BaseModel):
    plan: Plan


class BillingSessionOut(BaseModel):
    url: str


def _stripe_configured() -> bool:
    return (
        bool(settings.enable_billing)
        and bool(settings.stripe_secret_key)
        and bool(settings.web_base_url)
    )


def _price_id_for_plan(plan: Plan) -> str | None:
    match plan:
        case Plan.pro:
            return settings.stripe_price_id_pro
        case Plan.business:
            return settings.stripe_price_id_business
        case Plan.free:
            return None


@router.post("/checkout-session", response_model=BillingSessionOut)
def create_checkout_session(
    payload: CheckoutSessionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BillingSessionOut:
    if not _stripe_configured():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "error": {
                    "code": "BILLING_NOT_CONFIGURED",
                    "message": "Stripe billing is not configured.",
                }
            },
        )

    if payload.plan == Plan.free:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_PLAN",
                    "message": "Free plan does not require checkout.",
                }
            },
        )

    price_id = _price_id_for_plan(payload.plan)
    if not price_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "error": {
                    "code": "BILLING_NOT_CONFIGURED",
                    "message": "Stripe price not configured for this plan.",
                }
            },
        )

    stripe.api_key = settings.stripe_secret_key

    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            metadata={"clerk_user_id": user.clerk_user_id, "user_id": str(user.id)},
        )
        user.stripe_customer_id = customer.id
        db.add(user)
        db.commit()
        db.refresh(user)

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=user.stripe_customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        allow_promotion_codes=True,
        client_reference_id=user.clerk_user_id,
        success_url=f"{settings.web_base_url.rstrip('/')}/app/settings?checkout=success",
        cancel_url=f"{settings.web_base_url.rstrip('/')}/app/settings?checkout=cancel",
    )

    if not session.url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": {
                    "code": "BILLING_PROVIDER_ERROR",
                    "message": "Stripe did not return a checkout URL.",
                }
            },
        )

    return BillingSessionOut(url=session.url)


@router.post("/portal-session", response_model=BillingSessionOut)
def create_portal_session(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BillingSessionOut:
    if not _stripe_configured():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "error": {
                    "code": "BILLING_NOT_CONFIGURED",
                    "message": "Stripe billing is not configured.",
                }
            },
        )

    if not user.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "NO_STRIPE_CUSTOMER",
                    "message": "No Stripe customer exists for this user yet.",
                }
            },
        )

    stripe.api_key = settings.stripe_secret_key

    session = stripe.billing_portal.Session.create(
        customer=user.stripe_customer_id,
        return_url=f"{settings.web_base_url.rstrip('/')}/app/settings",
    )
    if not session.url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "error": {
                    "code": "BILLING_PROVIDER_ERROR",
                    "message": "Stripe did not return a portal URL.",
                }
            },
        )
    return BillingSessionOut(url=session.url)
