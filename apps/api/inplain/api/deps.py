from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.settings import settings


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    if settings.dev_auth_bypass:
        email = request.headers.get("X-Dev-Email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {"code": "UNAUTHENTICATED", "message": "Missing X-Dev-Email header."}
                },
            )

        clerk_user_id = request.headers.get("X-Dev-Clerk-User-Id") or email
        user = db.execute(
            select(User).where(User.clerk_user_id == clerk_user_id)
        ).scalar_one_or_none()
        if user is None:
            user = User(clerk_user_id=clerk_user_id, email=email)
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "error": {
                "code": "AUTH_NOT_IMPLEMENTED",
                "message": "Clerk auth is not wired up yet (set DEV_AUTH_BYPASS=1 for local dev).",
            }
        },
    )
