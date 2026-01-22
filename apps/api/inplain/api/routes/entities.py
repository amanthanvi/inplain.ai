from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.api.schemas import APIModel
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import UserRole
from inplain.db.models.snapshots import Snapshot
from inplain.db.models.users import User
from inplain.db.session import get_db

router = APIRouter(prefix="/v1/entities")


class EntityCreateIn(APIModel):
    name: str
    website_url: str | None = Field(default=None, alias="websiteUrl")


class EntityOut(APIModel):
    id: uuid.UUID
    name: str
    website_url: str | None = Field(alias="websiteUrl")
    created_at: datetime = Field(alias="createdAt")


class EntityListOut(APIModel):
    items: list[EntityOut]
    next_cursor: str | None = Field(alias="nextCursor")


def _encode_cursor(created_at: datetime, entity_id: uuid.UUID) -> str:
    return f"{created_at.isoformat()}::{entity_id}"


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    raw_dt, raw_id = cursor.split("::", maxsplit=1)
    return datetime.fromisoformat(raw_dt), uuid.UUID(raw_id)


@router.post("", response_model=EntityOut)
def create_entity(
    payload: EntityCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EntityOut:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "CUSTOM_TRACKING_DISABLED",
                    "message": "Custom URL tracking is disabled. Track curated companies instead.",
                }
            },
        )

    existing = db.execute(
        select(Entity).where(
            Entity.user_id == user.id, Entity.name == payload.name, Entity.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "ENTITY_ALREADY_EXISTS",
                    "message": "Entity already exists.",
                    "details": {"entityId": str(existing.id)},
                }
            },
        )

    entity = Entity(user_id=user.id, name=payload.name, website_url=payload.website_url)
    db.add(entity)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.execute(
            select(Entity).where(
                Entity.user_id == user.id,
                Entity.name == payload.name,
                Entity.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        raise HTTPException(
            status_code=409,
            detail={
                "error": {
                    "code": "ENTITY_ALREADY_EXISTS",
                    "message": "Entity already exists.",
                    "details": {"entityId": str(existing.id) if existing else None},
                }
            },
        ) from None
    db.refresh(entity)
    return EntityOut.model_validate(entity, from_attributes=True)


@router.get("", response_model=EntityListOut)
def list_entities(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> EntityListOut:
    stmt = select(Entity).where(Entity.user_id == user.id, Entity.deleted_at.is_(None))

    if cursor:
        cursor_created_at, cursor_id = _decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Entity.created_at < cursor_created_at,
                and_(
                    Entity.created_at == cursor_created_at,
                    Entity.id < cursor_id,
                ),
            )
        )

    stmt = stmt.order_by(Entity.created_at.desc(), Entity.id.desc()).limit(limit + 1)
    rows = list(db.execute(stmt).scalars().all())

    next_cursor: str | None = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = _encode_cursor(last.created_at, last.id)
        rows = rows[:limit]

    return EntityListOut(
        items=[EntityOut.model_validate(r, from_attributes=True) for r in rows],
        next_cursor=next_cursor,
    )


@router.get("/{entity_id}", response_model=EntityOut)
def get_entity(
    entity_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> EntityOut:
    entity = db.execute(
        select(Entity).where(
            Entity.id == entity_id,
            Entity.user_id == user.id,
            Entity.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if entity is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "ENTITY_NOT_FOUND", "message": "Entity not found."}},
        )

    return EntityOut.model_validate(entity, from_attributes=True)


@router.delete("/{entity_id}")
def delete_entity(
    entity_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    entity = db.execute(
        select(Entity).where(
            Entity.id == entity_id,
            Entity.user_id == user.id,
            Entity.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if entity is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "ENTITY_NOT_FOUND", "message": "Entity not found."}},
        )

    now = datetime.now(UTC)

    entity.deleted_at = now
    db.add(entity)

    doc_ids = (
        db.execute(
            select(Document.id).where(
                Document.user_id == user.id,
                Document.entity_id == entity_id,
                Document.deleted_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    if doc_ids:
        db.execute(
            update(Document)
            .where(Document.id.in_(doc_ids))
            .values(deleted_at=now)
        )
        db.execute(
            update(Snapshot)
            .where(Snapshot.document_id.in_(doc_ids))
            .values(retention_delete_at=now)
        )

    db.commit()
    return {"ok": True}
