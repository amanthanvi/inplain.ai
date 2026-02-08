from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.documents import Document
from inplain.db.models.entities import Entity
from inplain.db.models.enums import NotificationType
from inplain.db.models.notifications import Notification


def run_notify_job(db: Session, *, job_payload: dict, document_id: uuid.UUID | None) -> None:
    change_event_id = job_payload.get("change_event_id")
    if not change_event_id:
        raise ValueError("notify job missing change_event_id")

    ce_uuid = uuid.UUID(str(change_event_id))
    ce = db.execute(select(ChangeEvent).where(ChangeEvent.id == ce_uuid)).scalar_one()

    doc = db.execute(select(Document).where(Document.id == ce.document_id)).scalar_one()
    entity = db.execute(select(Entity).where(Entity.id == doc.entity_id)).scalar_one()

    notif = Notification(
        clerk_user_id=doc.clerk_user_id,
        type=NotificationType.change_detected,
        title=ce.title,
        body=f"{entity.name}: {doc.doc_type.value} updated",
        payload={
            "change_event_id": str(ce.id),
            "document_id": str(doc.id),
            "entity_slug": entity.slug,
            "doc_type": doc.doc_type.value,
        },
    )
    db.add(notif)

