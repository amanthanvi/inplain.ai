from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.api.deps import get_current_user
from inplain.db.models.documents import Document
from inplain.db.models.enums import EmailMode
from inplain.db.models.notification_preferences import NotificationPreference
from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.entitlements.service import ensure_entitlement
from inplain.notifications.preferences import (
    EffectiveEmailPreference,
    compute_effective_email_preference,
)

router = APIRouter(prefix="/v1")


class NotificationPreferenceIn(BaseModel):
    email_enabled: bool = Field(alias="emailEnabled")
    email_mode: EmailMode = Field(alias="emailMode")


class NotificationPreferenceOut(BaseModel):
    email_enabled: bool = Field(alias="emailEnabled")
    email_mode: EmailMode = Field(alias="emailMode")


class GlobalNotificationPreferenceOut(BaseModel):
    effective: NotificationPreferenceOut
    saved: NotificationPreferenceOut | None


class DocumentNotificationPreferenceOut(BaseModel):
    effective: NotificationPreferenceOut
    override: NotificationPreferenceOut | None


def _daily_digest_allowed(limits: dict) -> bool:
    return limits.get("email_notifications") == "immediate_and_daily_digest"


def _global_pref_row(db: Session, user_id: uuid.UUID) -> NotificationPreference | None:
    return (
        db.execute(
            select(NotificationPreference)
            .where(
                NotificationPreference.user_id == user_id,
                NotificationPreference.document_id.is_(None),
            )
            .order_by(NotificationPreference.created_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )


@router.get("/notification-preferences", response_model=GlobalNotificationPreferenceOut)
def get_global_notification_preferences(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
) -> GlobalNotificationPreferenceOut:
    row = _global_pref_row(db, user.id)
    saved = (
        EffectiveEmailPreference(email_enabled=row.email_enabled, email_mode=row.email_mode)
        if row is not None
        else None
    )
    effective = compute_effective_email_preference(global_pref=saved, document_pref=None)
    return GlobalNotificationPreferenceOut(
        effective=NotificationPreferenceOut(
            email_enabled=effective.email_enabled, email_mode=effective.email_mode
        ),
        saved=(
            NotificationPreferenceOut(
                email_enabled=saved.email_enabled,
                email_mode=saved.email_mode,
            )
            if saved is not None
            else None
        ),
    )


@router.put("/notification-preferences", response_model=GlobalNotificationPreferenceOut)
def put_global_notification_preferences(
    payload: NotificationPreferenceIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> GlobalNotificationPreferenceOut:
    entitlement = ensure_entitlement(db, user.id)
    if payload.email_mode == EmailMode.daily_digest and not _daily_digest_allowed(
        entitlement.limits
    ):
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "DAILY_DIGEST_NOT_ALLOWED",
                    "message": "Your plan does not include daily digests.",
                }
            },
        )

    row = _global_pref_row(db, user.id)
    if row is None:
        row = NotificationPreference(user_id=user.id, document_id=None)
        db.add(row)

    row.email_enabled = payload.email_enabled
    row.email_mode = payload.email_mode
    db.add(row)
    db.commit()

    saved = EffectiveEmailPreference(email_enabled=row.email_enabled, email_mode=row.email_mode)
    effective = compute_effective_email_preference(global_pref=saved, document_pref=None)
    return GlobalNotificationPreferenceOut(
        effective=NotificationPreferenceOut(
            email_enabled=effective.email_enabled, email_mode=effective.email_mode
        ),
        saved=NotificationPreferenceOut(
            email_enabled=saved.email_enabled,
            email_mode=saved.email_mode,
        ),
    )


@router.get(
    "/documents/{document_id}/notification-preference",
    response_model=DocumentNotificationPreferenceOut,
)
def get_document_notification_preference(
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentNotificationPreferenceOut:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user.id, Document.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    global_row = _global_pref_row(db, user.id)
    global_pref = (
        EffectiveEmailPreference(
            email_enabled=global_row.email_enabled,
            email_mode=global_row.email_mode,
        )
        if global_row is not None
        else None
    )

    override_row = (
        db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.id,
                NotificationPreference.document_id == doc.id,
            )
        )
        .scalars()
        .one_or_none()
    )
    override = (
        EffectiveEmailPreference(
            email_enabled=override_row.email_enabled,
            email_mode=override_row.email_mode,
        )
        if override_row is not None
        else None
    )
    effective = compute_effective_email_preference(global_pref=global_pref, document_pref=override)

    return DocumentNotificationPreferenceOut(
        effective=NotificationPreferenceOut(
            email_enabled=effective.email_enabled, email_mode=effective.email_mode
        ),
        override=(
            NotificationPreferenceOut(
                email_enabled=override.email_enabled,
                email_mode=override.email_mode,
            )
            if override is not None
            else None
        ),
    )


@router.put(
    "/documents/{document_id}/notification-preference",
    response_model=DocumentNotificationPreferenceOut,
)
def put_document_notification_preference(
    payload: NotificationPreferenceIn,
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentNotificationPreferenceOut:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user.id, Document.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    entitlement = ensure_entitlement(db, user.id)
    if payload.email_mode == EmailMode.daily_digest and not _daily_digest_allowed(
        entitlement.limits
    ):
        raise HTTPException(
            status_code=403,
            detail={
                "error": {
                    "code": "DAILY_DIGEST_NOT_ALLOWED",
                    "message": "Your plan does not include daily digests.",
                }
            },
        )

    row = (
        db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.id,
                NotificationPreference.document_id == doc.id,
            )
        )
        .scalars()
        .one_or_none()
    )
    if row is None:
        row = NotificationPreference(user_id=user.id, document_id=doc.id)
        db.add(row)

    row.email_enabled = payload.email_enabled
    row.email_mode = payload.email_mode
    db.add(row)
    db.commit()

    global_row = _global_pref_row(db, user.id)
    global_pref = (
        EffectiveEmailPreference(
            email_enabled=global_row.email_enabled,
            email_mode=global_row.email_mode,
        )
        if global_row is not None
        else None
    )
    override = EffectiveEmailPreference(email_enabled=row.email_enabled, email_mode=row.email_mode)
    effective = compute_effective_email_preference(global_pref=global_pref, document_pref=override)

    return DocumentNotificationPreferenceOut(
        effective=NotificationPreferenceOut(
            email_enabled=effective.email_enabled, email_mode=effective.email_mode
        ),
        override=NotificationPreferenceOut(
            email_enabled=override.email_enabled,
            email_mode=override.email_mode,
        ),
    )


@router.delete(
    "/documents/{document_id}/notification-preference",
    response_model=DocumentNotificationPreferenceOut,
)
def delete_document_notification_preference(
    document_id: uuid.UUID = Path(alias="documentId"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentNotificationPreferenceOut:
    doc = db.execute(
        select(Document).where(
            Document.id == document_id, Document.user_id == user.id, Document.deleted_at.is_(None)
        )
    ).scalar_one_or_none()
    if doc is None:
        raise HTTPException(
            status_code=404,
            detail={"error": {"code": "NOT_FOUND", "message": "Document not found."}},
        )

    override_row = (
        db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.id,
                NotificationPreference.document_id == doc.id,
            )
        )
        .scalars()
        .one_or_none()
    )
    if override_row is not None:
        db.delete(override_row)
        db.commit()

    global_row = _global_pref_row(db, user.id)
    global_pref = (
        EffectiveEmailPreference(
            email_enabled=global_row.email_enabled,
            email_mode=global_row.email_mode,
        )
        if global_row is not None
        else None
    )
    effective = compute_effective_email_preference(global_pref=global_pref, document_pref=None)

    return DocumentNotificationPreferenceOut(
        effective=NotificationPreferenceOut(
            email_enabled=effective.email_enabled, email_mode=effective.email_mode
        ),
        override=None,
    )
