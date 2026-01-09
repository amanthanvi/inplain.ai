from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
import jwt
from jwt import PyJWKClient

from inplain.settings import settings


@dataclass(frozen=True)
class VerifiedClerkToken:
    clerk_user_id: str
    claims: dict[str, Any]


def verify_session_token(token: str) -> VerifiedClerkToken:
    if not settings.clerk_jwks_url:
        raise RuntimeError("CLERK_JWKS_URL is required")
    if not settings.clerk_issuer:
        raise RuntimeError("CLERK_ISSUER is required")
    if not settings.clerk_jwt_audience:
        raise RuntimeError("CLERK_JWT_AUDIENCE is required")

    jwk_client = _get_jwk_client(settings.clerk_jwks_url)
    signing_key = jwk_client.get_signing_key_from_jwt(token)

    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=settings.clerk_issuer,
        audience=settings.clerk_jwt_audience,
        options={"require": ["exp", "sub", "iss", "aud"]},
    )

    clerk_user_id = claims.get("sub")
    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        raise RuntimeError("invalid token: missing sub")

    return VerifiedClerkToken(clerk_user_id=clerk_user_id, claims=claims)


def fetch_user_email(clerk_user_id: str) -> str | None:
    if not settings.clerk_secret_key:
        return None

    url = f"{settings.clerk_api_base_url.rstrip('/')}/v1/users/{clerk_user_id}"
    headers = {"Authorization": f"Bearer {settings.clerk_secret_key}"}
    with httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
        resp = client.get(url, headers=headers)

    if resp.status_code >= 400:
        raise RuntimeError(f"clerk api error: status {resp.status_code}")

    data = resp.json()

    primary_id = data.get("primary_email_address_id")
    email_addresses = data.get("email_addresses") or []
    if isinstance(primary_id, str):
        for item in email_addresses:
            if item.get("id") == primary_id and item.get("email_address"):
                return item["email_address"]

    for item in email_addresses:
        if item.get("email_address"):
            return item["email_address"]

    return None


_JWK_CLIENT: PyJWKClient | None = None


def _get_jwk_client(jwks_url: str) -> PyJWKClient:
    global _JWK_CLIENT
    if _JWK_CLIENT is None or _JWK_CLIENT.uri != jwks_url:
        _JWK_CLIENT = PyJWKClient(jwks_url)
    return _JWK_CLIENT

