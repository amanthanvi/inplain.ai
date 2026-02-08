from __future__ import annotations

import pytest


def test_http_fetch_timeout_config_is_valid(monkeypatch: pytest.MonkeyPatch) -> None:
    from inplain.worker.handlers import fetch as fetch_handler

    class DummyResp:
        status_code = 200
        headers = {"content-type": "text/html"}
        content = b"<html><body>ok</body></html>"

    class DummyClient:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        def __enter__(self) -> DummyClient:
            return self

        def __exit__(self, *_args: object, **_kwargs: object) -> None:
            return None

        def get(self, *_args: object, **_kwargs: object) -> DummyResp:
            return DummyResp()

    monkeypatch.setattr(fetch_handler.httpx, "Client", DummyClient)

    # Regression: httpx requires a default timeout or all 4 params.
    res = fetch_handler._http_fetch("https://example.com/privacy", None, None)
    assert res.http_status == 200


def test_fetch_robots_txt_timeout_config_is_valid(monkeypatch: pytest.MonkeyPatch) -> None:
    from inplain.worker.handlers import common as common_handler

    class DummyResp:
        status_code = 200
        text = "User-agent: *\nAllow: /"

    class DummyClient:
        def __init__(self, *_args: object, **_kwargs: object) -> None:
            pass

        def __enter__(self) -> DummyClient:
            return self

        def __exit__(self, *_args: object, **_kwargs: object) -> None:
            return None

        def get(self, *_args: object, **_kwargs: object) -> DummyResp:
            return DummyResp()

    monkeypatch.setattr(common_handler.httpx, "Client", DummyClient)

    out = common_handler._fetch_robots_txt("https://example.com")
    assert "User-agent" in out
