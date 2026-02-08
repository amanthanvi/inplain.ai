from __future__ import annotations

from fastapi import APIRouter, Depends

from inplain.api.deps import get_db

router = APIRouter(tags=["internal.webhooks"])


@router.post("/webhooks/clerk")
def clerk_webhook(_: object, __: object = Depends(get_db)) -> dict[str, bool]:
    # TODO(v0.1.0): Svix signature verification + event handling.
    return {"ok": True}

