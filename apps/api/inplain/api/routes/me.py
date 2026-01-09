from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import Plan
from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.entitlements.defaults import default_limits

router = APIRouter(prefix="/v1")


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    plan: Plan
    limits: dict


@router.get("/me", response_model=MeOut)
def get_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> MeOut:
    entitlement = db.execute(
        select(Entitlement).where(Entitlement.user_id == user.id)
    ).scalars().one_or_none()
    if entitlement is None:
        entitlement = Entitlement(user_id=user.id, plan=Plan.free, limits=default_limits(Plan.free))
        db.add(entitlement)
        db.commit()
        db.refresh(entitlement)

    return MeOut(id=user.id, email=user.email, plan=entitlement.plan, limits=entitlement.limits)
