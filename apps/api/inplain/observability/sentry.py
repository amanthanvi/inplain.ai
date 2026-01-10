from __future__ import annotations

import os

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from inplain.settings import settings


def init_sentry() -> None:
    if not settings.sentry_dsn:
        return

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.sentry_environment or os.getenv("RAILWAY_ENVIRONMENT") or "local",
        release=os.getenv("RAILWAY_GIT_COMMIT_SHA") or None,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        profiles_sample_rate=settings.sentry_profiles_sample_rate,
        integrations=[
            StarletteIntegration(),
            CeleryIntegration(),
        ],
        send_default_pii=False,
    )

    sentry_sdk.set_tag("service", settings.inplain_service_name)

