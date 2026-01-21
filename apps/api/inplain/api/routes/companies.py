from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.api.routes.documents import DocumentCreateIn, _create_document_impl
from inplain.api.schemas import APIModel
from inplain.catalog.company_catalog import COMPANY_CATALOG
from inplain.db.models.entities import Entity
from inplain.db.models.enums import FetchMode, ScheduleTier
from inplain.db.models.users import User
from inplain.db.session import get_db

router = APIRouter(prefix="/v1/companies")


class WatchCompanyOut(APIModel):
    entity_id: uuid.UUID = Field(alias="entityId")


@router.post("/{company_slug}/watch", response_model=WatchCompanyOut)
def watch_company(
    company_slug: str = Path(alias="companySlug"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WatchCompanyOut:
    company = COMPANY_CATALOG.get(company_slug)
    if company is None:
        raise HTTPException(
            status_code=404,
            detail={
                "error": {"code": "NOT_FOUND", "message": "Company is not in the curated catalog."}
            },
        )

    entity = db.execute(
        select(Entity).where(
            Entity.user_id == user.id,
            Entity.name == company["name"],
            Entity.deleted_at.is_(None),
        )
    ).scalar_one_or_none()

    if entity is None:
        entity = Entity(
            user_id=user.id,
            name=company["name"],
            website_url=company["website_url"],
        )
        db.add(entity)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            entity = db.execute(
                select(Entity).where(
                    Entity.user_id == user.id,
                    Entity.name == company["name"],
                    Entity.deleted_at.is_(None),
                )
            ).scalar_one_or_none()
            if entity is None:
                raise HTTPException(
                    status_code=500,
                    detail={
                        "error": {
                            "code": "ENTITY_CREATE_FAILED",
                            "message": "Failed to create tracked company.",
                        }
                    },
                ) from None

    for doc in company["documents"]:
        payload = DocumentCreateIn(
            url=doc["url"],
            doc_type=doc["doc_type"],
            schedule_tier=ScheduleTier.daily,
            fetch_mode=FetchMode.auto,
        )

        try:
            _create_document_impl(entity_id=entity.id, payload=payload, db=db, user=user)
        except HTTPException as exc:
            if exc.status_code == 409:
                continue
            raise

    return WatchCompanyOut(entity_id=entity.id)
