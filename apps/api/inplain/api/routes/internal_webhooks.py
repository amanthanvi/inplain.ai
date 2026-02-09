from __future__ import annotations

import json
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import delete
from sqlalchemy.orm import Session
from svix.webhooks import Webhook, WebhookVerificationError

from inplain.api.deps import get_db
from inplain.api.errors import ApiError
from inplain.db.models.documents import Document
from inplain.db.models.jobs import Job
from inplain.db.models.notifications import Notification
from inplain.settings import settings
from inplain.telemetry import capture_event

router = APIRouter(tags=["internal.webhooks"])


@router.post("/webhooks/clerk")
async def clerk_webhook(request: Request, db: Session = Depends(get_db)) -> dict[str, bool]:
    if not settings.clerk_webhook_secret:
        raise ApiError(
            status_code=500,
            code="WEBHOOK_NOT_CONFIGURED",
            message="CLERK_WEBHOOK_SECRET not set",
        )

    svix_id = request.headers.get("svix-id")
    svix_timestamp = request.headers.get("svix-timestamp")
    svix_signature = request.headers.get("svix-signature")
    if not svix_id or not svix_timestamp or not svix_signature:
        raise ApiError(status_code=400, code="BAD_REQUEST", message="Missing Svix headers")

    try:
        ts_int = int(svix_timestamp)
    except ValueError as exc:
        raise ApiError(
            status_code=400,
            code="BAD_REQUEST",
            message="Invalid svix-timestamp",
        ) from exc

    now_int = int(datetime.now(UTC).timestamp())
    if abs(now_int - ts_int) > 5 * 60:
        raise ApiError(status_code=400, code="WEBHOOK_REPLAY", message="Stale webhook timestamp")

    body = await request.body()
    wh = Webhook(settings.clerk_webhook_secret)
    try:
        event = wh.verify(
            body,
            {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            },
        )
    except WebhookVerificationError as exc:
        raise ApiError(
            status_code=400, code="WEBHOOK_SIGNATURE_INVALID", message="Invalid webhook signature"
        ) from exc

    if isinstance(event, bytes | str):
        event = json.loads(event)

    event_type = str((event or {}).get("type") or "")
    data = (event or {}).get("data") or {}

    if event_type == "user.deleted":
        clerk_user_id = str(data.get("id") or "")
        if clerk_user_id:
            db.execute(delete(Notification).where(Notification.clerk_user_id == clerk_user_id))
            db.execute(delete(Job).where(Job.clerk_user_id == clerk_user_id))
            db.execute(delete(Document).where(Document.clerk_user_id == clerk_user_id))
            db.commit()
    elif event_type == "user.created":
        clerk_user_id = str(data.get("id") or "")
        if clerk_user_id:
            capture_event(
                distinct_id=clerk_user_id,
                event="sign_up",
                properties={"source": "clerk_webhook"},
            )

    return {"ok": True}
