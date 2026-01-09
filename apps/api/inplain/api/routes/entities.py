from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.db.models.entities import Entity
from inplain.db.models.users import User
from inplain.db.session import get_db

router = APIRouter(prefix="/v1/entities")


class EntityCreateIn(BaseModel):
    name: str
    website_url: str | None = Field(default=None, alias="websiteUrl")


class EntityOut(BaseModel):
    id: uuid.UUID
    name: str
    website_url: str | None = Field(alias="websiteUrl")
    created_at: datetime = Field(alias="createdAt")


class EntityListOut(BaseModel):
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
    entity = Entity(user_id=user.id, name=payload.name, website_url=payload.website_url)
    db.add(entity)
    db.commit()
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
