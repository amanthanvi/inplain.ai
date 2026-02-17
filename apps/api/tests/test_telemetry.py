from __future__ import annotations

import pytest

from inplain import telemetry


def test_capture_event_swallows_posthog_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class _BoomPosthog:
        def capture(self, **_kwargs: object) -> None:
            raise RuntimeError("boom")

    monkeypatch.setattr(telemetry, "_POSTHOG", _BoomPosthog())

    telemetry.capture_event(
        distinct_id="user_123",
        event="test_event",
        properties={"source": "test"},
    )


def test_init_telemetry_swallows_posthog_init_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    class _BoomPosthog:
        def __init__(self, **_kwargs: object) -> None:
            raise RuntimeError("boom")

    monkeypatch.setattr(telemetry, "_POSTHOG", None)
    monkeypatch.setattr(telemetry, "Posthog", _BoomPosthog)
    monkeypatch.setattr(telemetry.settings, "posthog_api_key", "test-key")
    monkeypatch.setattr(telemetry.settings, "posthog_host", "https://example.com")

    telemetry.init_telemetry(service="api")

    assert telemetry._POSTHOG is None

