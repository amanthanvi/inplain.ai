from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inplain.api.deps import get_clerk_user_id, get_db
from inplain.api.schemas import DocumentOut, EnqueueResponse, EntityOut, WatchRequest, WatchResponse
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import DocumentDocType, JobQueue, JobStatus
from inplain.db.models.jobs import Job

router = APIRouter(tags=["internal.documents"])


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> list[DocumentOut]:
    docs = list(
        db.execute(
            select(Document)
            .where(Document.clerk_user_id == clerk_user_id, Document.deleted_at.is_(None))
            .order_by(Document.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [DocumentOut.model_validate(d, from_attributes=True) for d in docs]


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: uuid.UUID,
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> DocumentOut:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.clerk_user_id == clerk_user_id,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="not found")
    return DocumentOut.model_validate(doc, from_attributes=True)


@router.post("/documents/watch", response_model=WatchResponse)
def watch_entity(
    req: WatchRequest,
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> WatchResponse:
    entity = db.execute(select(Entity).where(Entity.slug == req.entity_slug)).scalar_one_or_none()
    if entity is None:
        raise HTTPException(status_code=404, detail="entity not found")

    now = datetime.now(UTC)
    policy_urls = entity.policy_urls or {}

    to_create: list[tuple[DocumentDocType, str]] = []
    if isinstance(policy_urls, dict):
        if policy_urls.get("privacy"):
            to_create.append((DocumentDocType.privacy, str(policy_urls["privacy"])))
        if policy_urls.get("tos"):
            to_create.append((DocumentDocType.tos, str(policy_urls["tos"])))
        if policy_urls.get("cookie"):
            to_create.append((DocumentDocType.cookie, str(policy_urls["cookie"])))

    if not to_create:
        raise HTTPException(status_code=400, detail="entity has no policy urls")

    if req.max_documents is not None:
        existing_doc_types = set(
            db.execute(
                select(Document.doc_type).where(
                    Document.clerk_user_id == clerk_user_id,
                    Document.entity_id == entity.id,
                    Document.deleted_at.is_(None),
                )
            )
            .scalars()
            .all()
        )
        would_create = sum(1 for doc_type, _ in to_create if doc_type not in existing_doc_types)
        if would_create > 0:
            tracked_count = db.execute(
                select(func.count(Document.id)).where(
                    Document.clerk_user_id == clerk_user_id,
                    Document.deleted_at.is_(None),
                )
            ).scalar_one()
            if int(tracked_count or 0) + would_create > req.max_documents:
                raise HTTPException(status_code=409, detail="document limit exceeded")

    documents: list[Document] = []
    for doc_type, url in to_create:
        existing = db.execute(
            select(Document).where(
                Document.clerk_user_id == clerk_user_id,
                Document.entity_id == entity.id,
                Document.doc_type == doc_type,
                Document.deleted_at.is_(None),
            )
        ).scalar_one_or_none()
        if existing is not None:
            if req.schedule_tier is not None and existing.schedule_tier != req.schedule_tier:
                existing.schedule_tier = req.schedule_tier
                db.add(existing)
            documents.append(existing)
            continue

        create_kwargs: dict[str, object] = {
            "clerk_user_id": clerk_user_id,
            "entity_id": entity.id,
            "url": url,
            "doc_type": doc_type,
            "next_check_at": now,
        }
        if req.schedule_tier is not None:
            create_kwargs["schedule_tier"] = req.schedule_tier

        doc = Document(**create_kwargs)
        db.add(doc)
        documents.append(doc)

    db.flush()

    for doc in documents:
        existing_job = db.execute(
            select(Job.id).where(
                Job.queue == JobQueue.fetch,
                Job.document_id == doc.id,
                Job.status.in_([JobStatus.queued, JobStatus.running]),
            )
        ).scalar_one_or_none()
        if existing_job is not None:
            continue

        db.add(
            Job(
                queue=JobQueue.fetch,
                clerk_user_id=clerk_user_id,
                document_id=doc.id,
                status=JobStatus.queued,
                run_at=now,
                payload={"reason": "watch_init"},
            )
        )

    db.commit()

    out_docs = [DocumentOut.model_validate(d, from_attributes=True) for d in documents]
    return WatchResponse(
        entity=EntityOut.model_validate(entity, from_attributes=True),
        documents=out_docs,
    )


@router.delete("/documents/{document_id}")
def delete_document(
    document_id: uuid.UUID,
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.clerk_user_id == clerk_user_id,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="not found")

    doc.deleted_at = datetime.now(UTC)
    db.add(doc)
    db.commit()
    return {"ok": True}


@router.post("/documents/{document_id}/check-now", response_model=EnqueueResponse)
def check_now(
    document_id: uuid.UUID,
    clerk_user_id: str = Depends(get_clerk_user_id),
    db: Session = Depends(get_db),
) -> EnqueueResponse:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.clerk_user_id == clerk_user_id,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="not found")

    now = datetime.now(UTC)
    existing_job = db.execute(
        select(Job.id).where(
            Job.queue == JobQueue.fetch,
            Job.document_id == doc.id,
            Job.status.in_([JobStatus.queued, JobStatus.running]),
        )
    ).scalar_one_or_none()
    if existing_job is not None:
        return EnqueueResponse(job_id=existing_job, queued=False)

    job = Job(
        queue=JobQueue.fetch,
        clerk_user_id=clerk_user_id,
        document_id=doc.id,
        status=JobStatus.queued,
        run_at=now,
        payload={"reason": "check_now"},
    )
    db.add(job)
    db.commit()
    return EnqueueResponse(job_id=job.id, queued=True)
