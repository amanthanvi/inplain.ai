from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.enums import EmailMode
from inplain.db.models.notification_preferences import NotificationPreference
from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.notifications.unsubscribe import verify_unsubscribe_token
from inplain.settings import settings

router = APIRouter(prefix="/v1")


@router.get("/unsubscribe", response_class=HTMLResponse)
def unsubscribe(
    token: str = Query(...),
    db: Session = Depends(get_db),
) -> HTMLResponse:
    if not settings.unsubscribe_secret:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail={
                "error": {
                    "code": "UNSUBSCRIBE_NOT_CONFIGURED",
                    "message": "Unsubscribe is not configured.",
                }
            },
        )

    user_id = verify_unsubscribe_token(token, secret=settings.unsubscribe_secret)
    if user_id is None:
        return HTMLResponse("Invalid unsubscribe link.", status_code=400)

    user = db.execute(select(User).where(User.id == user_id)).scalars().one_or_none()
    if user is None:
        return HTMLResponse("Unknown user.", status_code=404)

    pref = (
        db.execute(
            select(NotificationPreference).where(
                NotificationPreference.user_id == user.id,
                NotificationPreference.document_id.is_(None),
            )
        )
        .scalars()
        .one_or_none()
    )

    if pref is None:
        pref = NotificationPreference(
            user_id=user.id,
            document_id=None,
            email_enabled=False,
            email_mode=EmailMode.immediate,
        )
        db.add(pref)
    else:
        pref.email_enabled = False
        db.add(pref)

    db.commit()

    return HTMLResponse(
        "<h1>Unsubscribed</h1><p>You will no longer receive emails from Inplain.</p>",
        status_code=200,
    )
