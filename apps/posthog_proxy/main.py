from __future__ import annotations

from typing import Iterable

import httpx
from fastapi import FastAPI, Request, Response
from starlette.background import BackgroundTask
from starlette.responses import StreamingResponse


def _hop_by_hop_headers() -> set[str]:
    # RFC 2616 13.5.1. These must not be forwarded by proxies.
    return {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
    }


def _filter_headers(headers: Iterable[tuple[str, str]]) -> dict[str, str]:
    deny = _hop_by_hop_headers()
    out: dict[str, str] = {}
    for key, value in headers:
        lk = key.lower()
        if lk in deny:
            continue
        # Avoid sending a mismatched Content-Length when streaming.
        if lk == "content-length":
            continue
        out[key] = value
    return out


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(follow_redirects=False, timeout=httpx.Timeout(60.0))


app = FastAPI(title="inplain-posthog-proxy", version="0.1.0")

_CAPTURE_FIRST_SEGMENTS = {"capture", "e", "i"}


def _is_capture_path(path: str) -> bool:
    normalized = (path or "").lstrip("/")
    if not normalized:
        return False
    first = normalized.split("/", 1)[0]
    return first in _CAPTURE_FIRST_SEGMENTS


def _normalize_upstream(upstream: str) -> str:
    return upstream.rstrip("/") + "/"


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"ok": "true"}


@app.api_route(
    "/{path:path}",
    methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy(path: str, request: Request) -> Response:
    if _is_capture_path(path):
        upstream = request.app.state.capture_upstream
    else:
        upstream = request.app.state.web_upstream
    url = httpx.URL(upstream).join(path)
    if request.url.query:
        url = url.copy_with(query=request.url.query)

    headers = _filter_headers(request.headers.items())

    # Preserve the original host for PostHog to generate correct absolute URLs.
    # Also tell the upstream what protocol the client used.
    headers["x-forwarded-host"] = request.headers.get("host", "")
    headers["x-forwarded-proto"] = request.headers.get("x-forwarded-proto") or request.url.scheme

    # Send to the upstream with its own Host header to avoid relying on ALLOWED_HOSTS.
    headers["host"] = httpx.URL(upstream).host or headers.get("host", "")

    async with _client() as client:
        upstream_resp = await client.request(
            request.method,
            url,
            headers=headers,
            content=await request.body(),
        )

        response_headers = _filter_headers(upstream_resp.headers.items())

        async def _aiter_bytes() -> Iterable[bytes]:
            async for chunk in upstream_resp.aiter_bytes():
                yield chunk

        return StreamingResponse(
            _aiter_bytes(),
            status_code=upstream_resp.status_code,
            headers=response_headers,
            background=BackgroundTask(upstream_resp.aclose),
        )


@app.on_event("startup")
async def _startup() -> None:
    # Late-import env so unit tests can import this module without env config.
    import os

    web_upstream = os.environ.get("POSTHOG_WEB_UPSTREAM") or os.environ.get("POSTHOG_UPSTREAM")
    if not web_upstream:
        raise RuntimeError("POSTHOG_UPSTREAM (or POSTHOG_WEB_UPSTREAM) is required")

    capture_upstream = os.environ.get("POSTHOG_CAPTURE_UPSTREAM") or web_upstream

    app.state.web_upstream = _normalize_upstream(web_upstream)
    app.state.capture_upstream = _normalize_upstream(capture_upstream)
