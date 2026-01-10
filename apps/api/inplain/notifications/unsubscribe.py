from __future__ import annotations

import base64
import hashlib
import hmac
import uuid


def generate_unsubscribe_token(user_id: uuid.UUID, *, secret: str) -> str:
    raw = user_id.hex.encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).digest()
    return f"{user_id}.{_b64url(sig)}"


def verify_unsubscribe_token(token: str, *, secret: str) -> uuid.UUID | None:
    try:
        raw_id, raw_sig = token.split(".", maxsplit=1)
        user_id = uuid.UUID(raw_id)
    except Exception:
        return None

    expected = hmac.new(
        secret.encode("utf-8"), user_id.hex.encode("utf-8"), hashlib.sha256
    ).digest()
    try:
        actual = _b64url_decode(raw_sig)
    except Exception:
        return None

    # Enforce canonical base64url encoding (reject variants that decode to the same bytes).
    if not hmac.compare_digest(_b64url(actual), raw_sig):
        return None

    if not hmac.compare_digest(expected, actual):
        return None

    return user_id


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(text: str) -> bytes:
    padding = "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(text + padding)
