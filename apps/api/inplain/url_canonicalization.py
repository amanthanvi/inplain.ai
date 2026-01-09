from __future__ import annotations

import ipaddress
from urllib.parse import ParseResult, parse_qsl, urlencode, urlparse, urlunparse

from fastapi import HTTPException, status

_ALLOWED_QUERY_KEYS = {"lang", "locale"}


def canonicalize_url(raw_url: str) -> str:
    parsed = urlparse(raw_url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {
                    "code": "INVALID_URL",
                    "message": "URL must start with http:// or https://.",
                }
            },
        )

    if parsed.username or parsed.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {"code": "INVALID_URL", "message": "URL must not include credentials."}
            },
        )

    if not parsed.hostname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": {"code": "INVALID_URL", "message": "URL must include a hostname."}},
        )

    try:
        ipaddress.ip_address(parsed.hostname)
    except ValueError:
        pass
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {"code": "INVALID_URL", "message": "IP literal URLs are not allowed."}
            },
        )

    if parsed.port not in (None, 80, 443):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": {"code": "INVALID_URL", "message": "Only ports 80 and 443 are allowed."}
            },
        )

    host = parsed.hostname.lower()
    if host.startswith("www."):
        host = host[4:]

    path = parsed.path or ""
    if path.endswith("/") and len(path) > 1:
        path = path.rstrip("/")

    kept = [
        (k, v)
        for (k, v) in parse_qsl(parsed.query, keep_blank_values=True)
        if k in _ALLOWED_QUERY_KEYS
    ]
    query = urlencode(kept) if kept else ""

    netloc = host

    return urlunparse(
        ParseResult(
            scheme=parsed.scheme,
            netloc=netloc,
            path=path,
            params="",
            query=query,
            fragment="",
        )
    )
