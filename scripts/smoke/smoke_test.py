#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import sys
import time
from dataclasses import dataclass

import httpx


@dataclass
class CheckResult:
    name: str
    ok: bool
    details: str


def _env_first(*names: str, default: str) -> str:
    for name in names:
        value = (os.environ.get(name) or "").strip()
        if value:
            return value
    return default


def _ensure_http_scheme(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if url.startswith(("http://", "https://")):
        return url
    return f"https://{url}"


def _sign_internal_request(
    *,
    token: str,
    method: str,
    path: str,
    body: str = "",
) -> dict[str, str]:
    timestamp = str(int(time.time()))
    body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
    payload = f"{timestamp}\n{method.upper()}\n{path}\n{body_hash}"
    signature = hmac.new(token.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return {
        "authorization": f"Bearer {token}",
        "x-request-timestamp": timestamp,
        "x-request-signature": signature,
    }


def _check_http_200(client: httpx.Client, url: str, name: str) -> CheckResult:
    try:
        response = client.get(url)
    except Exception as exc:  # noqa: BLE001
        return CheckResult(name=name, ok=False, details=f"request failed: {exc}")
    if response.status_code != 200:
        return CheckResult(
            name=name,
            ok=False,
            details=f"expected 200, got {response.status_code}",
        )
    return CheckResult(name=name, ok=True, details="200 OK")


def _check_entities(
    *,
    client: httpx.Client,
    api_base_url: str,
    token: str,
    min_entities: int,
) -> CheckResult:
    path = "/internal/entities"
    headers = _sign_internal_request(token=token, method="GET", path=path)
    headers["x-clerk-user-id"] = "smoke-user"
    try:
        response = client.get(f"{api_base_url}{path}", headers=headers)
    except Exception as exc:  # noqa: BLE001
        return CheckResult(name="api entities", ok=False, details=f"request failed: {exc}")

    if response.status_code != 200:
        return CheckResult(
            name="api entities",
            ok=False,
            details=f"expected 200, got {response.status_code}",
        )

    try:
        payload = response.json()
    except json.JSONDecodeError as exc:
        return CheckResult(name="api entities", ok=False, details=f"invalid JSON: {exc}")

    if not isinstance(payload, list):
        return CheckResult(name="api entities", ok=False, details="payload is not a list")

    count = len(payload)
    if count < min_entities:
        return CheckResult(
            name="api entities",
            ok=False,
            details=f"expected >= {min_entities} entities, got {count}",
        )

    return CheckResult(name="api entities", ok=True, details=f"{count} entities")


def _check_posthog_capture(*, client: httpx.Client, posthog_host: str, api_key: str) -> CheckResult:
    name = "posthog capture"

    host = (posthog_host or "").strip()
    key = (api_key or "").strip()

    if bool(host) != bool(key):
        return CheckResult(
            name=name,
            ok=False,
            details="set POSTHOG_HOST and POSTHOG_API_KEY (or omit both)",
        )

    if not host and not key:
        return CheckResult(name=name, ok=True, details="skipped")

    url = host.rstrip("/") + "/capture/"
    payload = {
        "api_key": key,
        "event": "smoke_test",
        "properties": {
            "distinct_id": "smoke-test",
            "source": "inplain-smoke",
        },
    }

    try:
        response = client.post(url, json=payload)
    except Exception as exc:  # noqa: BLE001
        return CheckResult(name=name, ok=False, details=f"request failed: {exc}")

    if response.status_code != 200:
        text = (response.text or "").strip().replace("\n", " ")
        return CheckResult(
            name=name,
            ok=False,
            details=f"expected 200, got {response.status_code}: {text[:200]}",
        )

    return CheckResult(name=name, ok=True, details="200 OK")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run post-deploy smoke checks.")
    parser.add_argument(
        "--web-base-url",
        default=_env_first("WEB_BASE_URL", "RAILWAY_SERVICE_WEB_URL", default="http://localhost:3000"),
    )
    parser.add_argument(
        "--api-base-url",
        default=_env_first(
            "API_BASE_URL",
            "API_PUBLIC_BASE_URL",
            "RAILWAY_SERVICE_API_URL",
            default="http://localhost:8000",
        ),
    )
    parser.add_argument(
        "--internal-service-token",
        default=_env_first("INTERNAL_SERVICE_TOKEN", default=""),
    )
    parser.add_argument(
        "--posthog-host",
        default=_env_first("RAILWAY_SERVICE_POSTHOG_PROXY_URL", "POSTHOG_HOST", default=""),
    )
    parser.add_argument(
        "--posthog-api-key",
        default=_env_first("POSTHOG_API_KEY", "NEXT_PUBLIC_POSTHOG_KEY", default=""),
    )
    parser.add_argument("--min-entities", type=int, default=30)
    args = parser.parse_args()

    args.web_base_url = _ensure_http_scheme(args.web_base_url)
    args.api_base_url = _ensure_http_scheme(args.api_base_url)
    args.posthog_host = _ensure_http_scheme(args.posthog_host)

    if not args.internal_service_token:
        print("INTERNAL_SERVICE_TOKEN is required.")
        return 2

    timeout = httpx.Timeout(30, connect=10)
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        results = [
            _check_http_200(client, f"{args.web_base_url}/", "web root"),
            _check_http_200(client, f"{args.web_base_url}/companies", "web companies"),
            _check_http_200(client, f"{args.api_base_url}/healthz", "api healthz"),
            _check_entities(
                client=client,
                api_base_url=args.api_base_url,
                token=args.internal_service_token,
                min_entities=args.min_entities,
            ),
        ]

        if args.posthog_host or args.posthog_api_key:
            results.append(
                _check_posthog_capture(
                    client=client,
                    posthog_host=args.posthog_host,
                    api_key=args.posthog_api_key,
                )
            )

    has_failures = False
    for result in results:
        status = "PASS" if result.ok else "FAIL"
        print(f"[{status}] {result.name}: {result.details}")
        has_failures = has_failures or not result.ok

    return 1 if has_failures else 0


if __name__ == "__main__":
    sys.exit(main())
