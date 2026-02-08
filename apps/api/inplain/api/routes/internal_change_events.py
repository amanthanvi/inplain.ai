from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.api.deps import get_clerk_user_id, get_db
from inplain.api.schemas import ChangeEventDetailOut, ChangeEventOut, DiffOut
from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document

router = APIRouter(tags=["internal.change_events"])


@router.get("/change-events", response_model=list[ChangeEventOut])
def list_change_events(
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> list[ChangeEventOut]:
    stmt = (
        select(ChangeEvent)
        .join(Document, Document.id == ChangeEvent.document_id)
        .where(Document.clerk_user_id == clerk_user_id, Document.deleted_at.is_(None))
        .order_by(ChangeEvent.created_at.desc())
        .limit(200)
    )
    events = list(db.execute(stmt).scalars().all())
    return [ChangeEventOut.model_validate(e, from_attributes=True) for e in events]


@router.get("/change-events/{change_event_id}", response_model=ChangeEventDetailOut)
def get_change_event(
    change_event_id: uuid.UUID,
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> ChangeEventDetailOut:
    stmt = (
        select(ChangeEvent)
        .join(Document, Document.id == ChangeEvent.document_id)
        .where(
            ChangeEvent.id == change_event_id,
            Document.clerk_user_id == clerk_user_id,
            Document.deleted_at.is_(None),
        )
    )
    event = db.execute(stmt).scalar_one_or_none()
    if event is None:
        raise HTTPException(status_code=404, detail="not found")

    diff = db.execute(select(Diff).where(Diff.id == event.diff_id)).scalar_one()
    return ChangeEventDetailOut(
        change_event=ChangeEventOut.model_validate(event, from_attributes=True),
        diff=DiffOut.model_validate(diff, from_attributes=True),
    )
