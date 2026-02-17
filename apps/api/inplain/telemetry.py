from __future__ import annotations

from threading import Lock
from typing import Any

import sentry_sdk
from posthog import Posthog

from inplain.settings import settings

_LOCK = Lock()
_SENTRY_INITIALIZED = False
_POSTHOG: Posthog | None = None


def init_telemetry(*, service: str) -> None:
    global _SENTRY_INITIALIZED, _POSTHOG  # noqa: PLW0603
    with _LOCK:
        if settings.sentry_dsn and not _SENTRY_INITIALIZED:
            sentry_sdk.init(
                dsn=settings.sentry_dsn,
                environment=settings.sentry_environment,
                traces_sample_rate=settings.sentry_traces_sample_rate,
                release=f"inplain-{service}",
            )
            _SENTRY_INITIALIZED = True

        if settings.posthog_api_key and settings.posthog_host and _POSTHOG is None:
            try:
                _POSTHOG = Posthog(
                    project_api_key=settings.posthog_api_key,
                    host=settings.posthog_host,
                )
            except Exception:  # noqa: BLE001
                _POSTHOG = None


def capture_event(
    *,
    distinct_id: str,
    event: str,
    properties: dict[str, Any] | None = None,
) -> None:
    if not distinct_id:
        return
    if _POSTHOG is None:
        return
    try:
        _POSTHOG.capture(distinct_id=distinct_id, event=event, properties=properties or {})
    except Exception:  # noqa: BLE001
        return
