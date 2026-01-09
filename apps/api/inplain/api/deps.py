from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.auth.clerk import fetch_user_email, verify_session_token
from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import Plan, UserStatus
from inplain.db.models.users import User
from inplain.db.session import get_db
from inplain.entitlements.defaults import default_limits
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

    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "UNAUTHENTICATED",
                    "message": "Missing Authorization header.",
                }
            },
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        verified = verify_session_token(token)
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "UNAUTHENTICATED",
                    "message": "Invalid session token.",
                }
            },
        )

    user = db.execute(
        select(User).where(User.clerk_user_id == verified.clerk_user_id)
    ).scalar_one_or_none()
    if user is None:
        email = None
        if isinstance(verified.claims.get("email"), str):
            email = verified.claims["email"]
        if email is None:
            email = fetch_user_email(verified.clerk_user_id)
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": {
                        "code": "UNAUTHENTICATED",
                        "message": "Unable to resolve user email.",
                    }
                },
            )

        user = User(clerk_user_id=verified.clerk_user_id, email=email)
        db.add(user)
        db.flush()

        entitlement = Entitlement(
            user_id=user.id,
            plan=Plan.free,
            limits=default_limits(Plan.free),
        )
        db.add(entitlement)
        db.commit()
        db.refresh(user)
        return user

    if user.status != UserStatus.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "FORBIDDEN",
                    "message": "Account is not active.",
                }
            },
        )

    entitlement = (
        db.execute(select(Entitlement).where(Entitlement.user_id == user.id))
        .scalars()
        .one_or_none()
    )
    if entitlement is None:
        entitlement = Entitlement(
            user_id=user.id,
            plan=Plan.free,
            limits=default_limits(Plan.free),
        )
        db.add(entitlement)
        db.commit()

    return user
