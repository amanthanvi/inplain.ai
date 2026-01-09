from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import Plan
from inplain.entitlements.defaults import default_limits


def ensure_entitlement(db: Session, user_id: uuid.UUID) -> Entitlement:
    entitlement = (
        db.execute(select(Entitlement).where(Entitlement.user_id == user_id))
        .scalars()
        .one_or_none()
    )
    if entitlement is None:
        entitlement = Entitlement(user_id=user_id, plan=Plan.free, limits=default_limits(Plan.free))
        db.add(entitlement)
        db.flush()
    return entitlement
