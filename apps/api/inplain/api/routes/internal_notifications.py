from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from inplain.api.deps import get_clerk_user_id, get_db
from inplain.api.schemas import MarkReadRequest, NotificationOut, UnreadCountOut
from inplain.db.models.notifications import Notification

router = APIRouter(tags=["internal.notifications"])


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> list[NotificationOut]:
    notes = list(
        db.execute(
            select(Notification)
            .where(Notification.clerk_user_id == clerk_user_id)
            .order_by(Notification.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    return [NotificationOut.model_validate(n, from_attributes=True) for n in notes]


@router.get("/notifications/unread-count", response_model=UnreadCountOut)
def unread_count(
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> UnreadCountOut:
    unread = db.execute(
        select(func.count(Notification.id)).where(
            Notification.clerk_user_id == clerk_user_id, Notification.read_at.is_(None)
        )
    ).scalar_one()
    return UnreadCountOut(unread=int(unread))


@router.post("/notifications/mark-read")
def mark_read(
    req: MarkReadRequest,
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    if not req.notification_ids:
        return {"ok": True}
    db.execute(
        update(Notification)
        .where(
            Notification.clerk_user_id == clerk_user_id,
            Notification.id.in_(req.notification_ids),
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    db.commit()
    return {"ok": True}

