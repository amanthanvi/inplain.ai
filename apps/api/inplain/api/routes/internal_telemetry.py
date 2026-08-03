"""Telemetry relay for events the web tier observes.

Most product events are captured where they happen, inside the API. Two are
not observable here:

- `citation_clicked` is a browser interaction inside the diff viewer.
- `upgrade_completed` is known only to the Clerk billing webhook, which
  terminates on the web tier.

Rather than add a client-side PostHog SDK - which would put a second
analytics path and a third-party script in front of users, against the
SPEC's "browser never touches FastAPI" shape - the web tier relays these
through the same HMAC-signed internal channel as everything else.

The event name is checked against an allowlist so this cannot become an
open pipe into the analytics project.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from inplain.api.deps import get_clerk_user_id
from inplain.api.schemas import TelemetryEventRequest
from inplain.telemetry import capture_event

router = APIRouter(tags=["internal.telemetry"])

# Only events the web tier is the sole observer of. Anything the API can see
# for itself is captured at its source instead.
_RELAYABLE_EVENTS = frozenset({"citation_clicked", "upgrade_completed"})

# Bound what a caller can attach, so relayed properties cannot smuggle in
# unbounded or unexpected payloads.
_MAX_PROPERTIES = 12
_MAX_VALUE_CHARS = 200


@router.post("/telemetry", status_code=202)
def relay_event(
    req: TelemetryEventRequest,
    clerk_user_id: str = Depends(get_clerk_user_id),
) -> dict[str, bool]:
    if req.event not in _RELAYABLE_EVENTS:
        raise HTTPException(status_code=400, detail="event not relayable")

    properties = dict(req.properties or {})
    if len(properties) > _MAX_PROPERTIES:
        raise HTTPException(status_code=400, detail="too many properties")

    safe: dict[str, object] = {}
    for key, value in properties.items():
        if isinstance(value, str):
            safe[key] = value[:_MAX_VALUE_CHARS]
        elif isinstance(value, bool | int | float) or value is None:
            safe[key] = value
        else:
            safe[key] = str(value)[:_MAX_VALUE_CHARS]

    capture_event(distinct_id=clerk_user_id, event=req.event, properties=safe)
    return {"accepted": True}
