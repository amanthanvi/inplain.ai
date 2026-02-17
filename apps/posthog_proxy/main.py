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


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"ok": "true"}


@app.api_route(
    "/{path:path}",
    methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy(path: str, request: Request) -> Response:
    upstream = request.app.state.upstream
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

    upstream = os.environ.get("POSTHOG_UPSTREAM")
    if not upstream:
        raise RuntimeError("POSTHOG_UPSTREAM is required")
    app.state.upstream = upstream.rstrip("/") + "/"
