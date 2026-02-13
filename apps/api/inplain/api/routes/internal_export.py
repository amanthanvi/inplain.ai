from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.api.deps import get_clerk_user_id, get_db
from inplain.api.schemas import (
    ChangeEventDetailOut,
    ChangeEventOut,
    DiffOut,
    DocumentOut,
    EntityOut,
    ExportOut,
)
from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity

router = APIRouter(tags=["internal.export"])


@router.get("/export", response_model=ExportOut)
def export_json(
    limit_change_events: int | None = Query(default=None, ge=1, le=5000),
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> ExportOut:
    now = datetime.now(UTC)

    documents = list(
        db.execute(
            select(Document)
            .where(Document.clerk_user_id == clerk_user_id, Document.deleted_at.is_(None))
            .order_by(Document.created_at.desc())
        )
        .scalars()
        .all()
    )

    entity_ids = sorted({d.entity_id for d in documents})
    entities = list(db.execute(select(Entity).where(Entity.id.in_(entity_ids))).scalars().all())

    requested_limit = int(limit_change_events) if limit_change_events is not None else None
    fetch_limit = requested_limit + 1 if requested_limit is not None else None

    stmt = (
        select(ChangeEvent, Diff)
        .join(Document, Document.id == ChangeEvent.document_id)
        .join(Diff, Diff.id == ChangeEvent.diff_id)
        .where(Document.clerk_user_id == clerk_user_id, Document.deleted_at.is_(None))
        .order_by(ChangeEvent.created_at.desc())
    )
    if fetch_limit is not None:
        stmt = stmt.limit(fetch_limit)

    rows = list(db.execute(stmt).all())

    truncated = False
    if requested_limit is not None and len(rows) > requested_limit:
        truncated = True
        rows = rows[:requested_limit]

    change_events: list[ChangeEventDetailOut] = []
    for event, diff in rows:
        change_events.append(
            ChangeEventDetailOut(
                change_event=ChangeEventOut.model_validate(event, from_attributes=True),
                diff=DiffOut.model_validate(diff, from_attributes=True),
            )
        )

    return ExportOut(
        generated_at=now,
        truncated=truncated,
        limit_change_events=requested_limit,
        entities=[EntityOut.model_validate(e, from_attributes=True) for e in entities],
        documents=[DocumentOut.model_validate(d, from_attributes=True) for d in documents],
        change_events=change_events,
    )
