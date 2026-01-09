from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.db.models.users import User
from inplain.db.session import get_db

router = APIRouter(prefix="/v1/billing")


class CheckoutSessionIn(BaseModel):
    plan: str


class BillingSessionOut(BaseModel):
    url: str


@router.post("/checkout-session", response_model=BillingSessionOut)
def create_checkout_session(
    payload: CheckoutSessionIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BillingSessionOut:
    _ = (db, user, payload)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": {
                "code": "BILLING_NOT_CONFIGURED",
                "message": "Stripe billing is not configured.",
            }
        },
    )


@router.post("/portal-session", response_model=BillingSessionOut)
def create_portal_session(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> BillingSessionOut:
    _ = (db, user)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": {
                "code": "BILLING_NOT_CONFIGURED",
                "message": "Stripe billing is not configured.",
            }
        },
    )
