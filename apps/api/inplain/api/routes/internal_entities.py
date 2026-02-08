from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.api.deps import get_db
from inplain.api.schemas import EntityOut
from inplain.db.models.entities import Entity

router = APIRouter(tags=["internal.entities"])


@router.get("/entities", response_model=list[EntityOut])
def list_entities(db: Session = Depends(get_db)) -> list[EntityOut]:
    entities = list(db.execute(select(Entity).order_by(Entity.slug.asc())).scalars().all())
    return [EntityOut.model_validate(e, from_attributes=True) for e in entities]


@router.get("/entities/{slug}", response_model=EntityOut)
def get_entity(slug: str, db: Session = Depends(get_db)) -> EntityOut:
    entity = db.execute(select(Entity).where(Entity.slug == slug)).scalar_one_or_none()
    if entity is None:
        raise HTTPException(status_code=404, detail="not found")
    return EntityOut.model_validate(entity, from_attributes=True)

