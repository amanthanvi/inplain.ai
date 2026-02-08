from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.api.deps import get_clerk_user_id, get_db
from inplain.api.schemas import SnapshotOut
from inplain.db.models.documents import Document
from inplain.db.models.snapshots import Snapshot

router = APIRouter(tags=["internal.snapshots"])


@router.get("/snapshots/{snapshot_id}", response_model=SnapshotOut)
def get_snapshot(
    snapshot_id: uuid.UUID,
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> SnapshotOut:
    stmt = (
        select(Snapshot)
        .join(Document, Document.id == Snapshot.document_id)
        .where(
            Snapshot.id == snapshot_id,
            Document.clerk_user_id == clerk_user_id,
            Document.deleted_at.is_(None),
        )
    )
    snap = db.execute(stmt).scalar_one_or_none()
    if snap is None:
        raise HTTPException(status_code=404, detail="not found")
    return SnapshotOut.model_validate(snap, from_attributes=True)

