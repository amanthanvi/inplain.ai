from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

import redis
from fastapi import HTTPException, Request, status
from starlette.types import ASGIApp, Receive, Scope, Send

from inplain.db.models.enums import Plan
from inplain.settings import settings

_WINDOW_SECONDS = 60


@dataclass(frozen=True)
class _RateLimitResult:
    allowed: bool
    retry_after_seconds: int


def _plan_limit(plan: Plan, bucket: str) -> int:
    match plan:
        case Plan.free:
            limits = {"api_read": 120, "api_write": 30, "check_now": 5}
        case Plan.pro:
            limits = {"api_read": 300, "api_write": 60, "check_now": 20}
        case Plan.business:
            limits = {"api_read": 600, "api_write": 120, "check_now": 60}

    return limits.get(bucket, limits["api_read"])


def _bucket_for_request(request: Request) -> str | None:
    if request.method == "OPTIONS":
        return None

    path = request.url.path
    if request.method == "POST" and path.endswith("/check-now"):
        return "check_now"

    if request.method in {"GET", "HEAD"}:
        return "api_read"

    return "api_write"


def _client_ip(request: Request) -> str | None:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",", maxsplit=1)[0].strip() or None
    if request.client:
        return request.client.host
    return None


_REDIS: redis.Redis | None = None


def _redis_client() -> redis.Redis:
    global _REDIS
    if _REDIS is None:
        _REDIS = redis.Redis.from_url(
            settings.redis_url,
            socket_connect_timeout=1.0,
            socket_timeout=1.0,
            decode_responses=False,
        )
    return _REDIS


def _check_rate_limit(*, key: str, limit: int) -> _RateLimitResult:
    now = time.time()
    window_start = now - _WINDOW_SECONDS

    try:
        member = f"{now}:{uuid.uuid4()}"
        r = _redis_client()
        pipe = r.pipeline(transaction=True)
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {member: now})
        pipe.zcard(key)
        pipe.expire(key, _WINDOW_SECONDS + 5)
        _, _, count, _ = pipe.execute()

        if isinstance(count, int) and count <= limit:
            return _RateLimitResult(allowed=True, retry_after_seconds=0)

        earliest = r.zrange(key, 0, 0, withscores=True)
        if earliest:
            retry_after = max(1, int(_WINDOW_SECONDS - (now - float(earliest[0][1]))))
        else:
            retry_after = _WINDOW_SECONDS
        return _RateLimitResult(allowed=False, retry_after_seconds=retry_after)
    except Exception:
        return _RateLimitResult(allowed=True, retry_after_seconds=0)


def enforce_ip_rate_limit(request: Request) -> None:
    bucket = _bucket_for_request(request)
    if bucket is None:
        return

    path = request.url.path
    if path == "/healthz" or path.startswith("/v1/webhooks/"):
        return

    ip = _client_ip(request)
    if not ip:
        return

    result = _check_rate_limit(key=f"rl:ip:{ip}:{bucket}", limit=_plan_limit(Plan.free, bucket))
    if result.allowed:
        return

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        headers={"Retry-After": str(result.retry_after_seconds)},
        detail={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Please try again later.",
            }
        },
    )


def enforce_user_rate_limit(request: Request, *, user_id: str, plan: Plan) -> None:
    bucket = _bucket_for_request(request)
    if bucket is None:
        return

    result = _check_rate_limit(
        key=f"rl:user:{user_id}:{bucket}",
        limit=_plan_limit(plan, bucket),
    )
    if result.allowed:
        return

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        headers={"Retry-After": str(result.retry_after_seconds)},
        detail={
            "error": {
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "Too many requests. Please try again later.",
            }
        },
    )


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive=receive)
        try:
            enforce_ip_rate_limit(request)
        except HTTPException as exc:
            body = (str(exc.detail) if isinstance(exc.detail, str) else None) or ""
            if not body:
                import json

                body = json.dumps(exc.detail)
            headers = [(b"content-type", b"application/json")]
            if exc.headers:
                for k, v in exc.headers.items():
                    headers.append((k.encode("utf-8"), v.encode("utf-8")))

            await send(
                {"type": "http.response.start", "status": exc.status_code, "headers": headers}
            )
            await send({"type": "http.response.body", "body": body.encode("utf-8")})
            return

        await self.app(scope, receive, send)
