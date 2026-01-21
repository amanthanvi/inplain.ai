from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import Field
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.api.schemas import APIModel
from inplain.db.models.documents import Document
from inplain.db.models.snapshots import Snapshot
from inplain.db.models.users import User
from inplain.db.session import get_db

router = APIRouter(prefix="/v1")


class SnapshotListItem(APIModel):
    id: uuid.UUID
    fetched_at: datetime = Field(alias="fetchedAt")
    fetch_method: str = Field(alias="fetchMethod")
    http_status: int = Field(alias="httpStatus")
    final_url: str = Field(alias="finalUrl")
    content_type: str | None = Field(alias="contentType")
    language: str | None
    byte_size_raw: int | None = Field(alias="byteSizeRaw")
    byte_size_extracted: int = Field(alias="byteSizeExtracted")
    extract_version: int = Field(alias="extractVersion")


class SnapshotListOut(APIModel):
    items: list[SnapshotListItem]
    next_cursor: str | None = Field(alias="nextCursor")


class SnapshotOut(SnapshotListItem):
    document_id: uuid.UUID = Field(alias="documentId")
    extracted_text: str = Field(alias="extractedText")
    raw_storage_key: str | None = Field(alias="rawStorageKey")
    raw_sha256: str = Field(alias="rawSha256")
    extracted_sha256: str = Field(alias="extractedSha256")


def _encode_cursor(fetched_at: datetime, snapshot_id: uuid.UUID) -> str:
    return f"{fetched_at.isoformat()}::{snapshot_id}"


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    raw_dt, raw_id = cursor.split("::", maxsplit=1)
    return datetime.fromisoformat(raw_dt), uuid.UUID(raw_id)


def _snapshot_out(snapshot: Snapshot) -> SnapshotOut:
    return SnapshotOut(
        id=snapshot.id,
        document_id=snapshot.document_id,
        fetched_at=snapshot.fetched_at,
        fetch_method=snapshot.fetch_method.value
        if hasattr(snapshot.fetch_method, "value")
        else str(snapshot.fetch_method),
        http_status=snapshot.http_status,
        final_url=snapshot.final_url,
        content_type=snapshot.content_type,
        language=snapshot.language,
        byte_size_raw=snapshot.byte_size_raw,
        byte_size_extracted=snapshot.byte_size_extracted,
        extract_version=snapshot.extract_version,
        extracted_text=snapshot.extracted_text,
        raw_storage_key=snapshot.raw_storage_key,
        raw_sha256=snapshot.raw_sha256.hex(),
        extracted_sha256=snapshot.extracted_sha256.hex(),
    )


@router.get("/documents/{document_id}/snapshots", response_model=SnapshotListOut)
def list_snapshots(
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> SnapshotListOut:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == user.id,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    stmt = select(Snapshot).where(Snapshot.document_id == doc.id)
    if cursor:
        cursor_fetched_at, cursor_id = _decode_cursor(cursor)
        stmt = stmt.where(
            or_(
                Snapshot.fetched_at < cursor_fetched_at,
                and_(Snapshot.fetched_at == cursor_fetched_at, Snapshot.id < cursor_id),
            )
        )

    stmt = stmt.order_by(Snapshot.fetched_at.desc(), Snapshot.id.desc()).limit(limit + 1)
    rows = list(db.execute(stmt).scalars().all())

    next_cursor: str | None = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = _encode_cursor(last.fetched_at, last.id)
        rows = rows[:limit]

    return SnapshotListOut(
        items=[
            SnapshotListItem(
                id=s.id,
                fetched_at=s.fetched_at,
                fetch_method=s.fetch_method.value
                if hasattr(s.fetch_method, "value")
                else str(s.fetch_method),
                http_status=s.http_status,
                final_url=s.final_url,
                content_type=s.content_type,
                language=s.language,
                byte_size_raw=s.byte_size_raw,
                byte_size_extracted=s.byte_size_extracted,
                extract_version=s.extract_version,
            )
            for s in rows
        ],
        next_cursor=next_cursor,
    )


@router.get("/documents/{document_id}/snapshots/latest", response_model=SnapshotOut)
def get_latest_snapshot(
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SnapshotOut:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == user.id,
            Document.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    snapshot = db.execute(
        select(Snapshot)
        .where(Snapshot.document_id == doc.id)
        .order_by(Snapshot.fetched_at.desc(), Snapshot.id.desc())
        .limit(1)
    ).scalar_one_or_none()
    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NO_SNAPSHOTS", "message": "No snapshots captured yet."}},
        )

    return _snapshot_out(snapshot)


@router.get("/snapshots/{snapshot_id}", response_model=SnapshotOut)
def get_snapshot(
    snapshot_id: uuid.UUID = Path(alias="snapshotId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SnapshotOut:
    row = db.execute(
        select(Snapshot, Document)
        .join(Document, Snapshot.document_id == Document.id)
        .where(
            Snapshot.id == snapshot_id,
            Document.user_id == user.id,
            Document.deleted_at.is_(None),
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Snapshot not found."}},
        )

    snapshot, _document = row
    return _snapshot_out(snapshot)

