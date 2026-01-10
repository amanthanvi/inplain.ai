from __future__ import annotations

import os
from typing import Any

from inplain.settings import settings

_OTEL_INITIALIZED = False


def init_otel() -> None:
    global _OTEL_INITIALIZED
    if _OTEL_INITIALIZED:
        return

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    if not endpoint:
        return

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except Exception:
        return

    headers = _parse_headers(os.getenv("OTEL_EXPORTER_OTLP_HEADERS", ""))

    resource = Resource.create({"service.name": settings.inplain_service_name})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(
        BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, headers=headers))
    )
    trace.set_tracer_provider(provider)

    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

        HTTPXClientInstrumentor().instrument()
    except Exception:
        pass

    _OTEL_INITIALIZED = True


def instrument_fastapi(app: Any) -> None:
    if not os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip():
        return

    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        FastAPIInstrumentor.instrument_app(app)
    except Exception:
        return


def _parse_headers(raw: str) -> dict[str, str] | None:
    raw = raw.strip()
    if not raw:
        return None

    pairs = [p.strip() for p in raw.split(",") if p.strip()]
    headers: dict[str, str] = {}
    for pair in pairs:
        if "=" not in pair:
            continue
        key, value = pair.split("=", maxsplit=1)
        key = key.strip()
        value = value.strip()
        if key:
            headers[key] = value

    return headers or None
