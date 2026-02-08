from __future__ import annotations

import socket

import pytest

from inplain.worker.handlers.common import RobotsDecision, strip_cosmetic, validate_public_http_url


def test_strip_cosmetic_removes_copyright_and_effective_lines() -> None:
    text = "\n".join(
        [
            "Effective date: Jan 1, 2026",
            "Hello world",
            "",
            "© 2026 Example Inc.",
            "More text",
        ]
    )
    out = strip_cosmetic(text)
    assert "Effective date" not in out
    assert "© 2026" not in out
    assert "Hello world" in out
    assert "More text" in out


def test_validate_public_http_url_allows_public_domain(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_getaddrinfo(*_args: object, **_kwargs: object) -> list[tuple[object, ...]]:
        return [(0, 0, 0, "", ("93.184.216.34", 443))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    validate_public_http_url("https://example.com/privacy")


def test_validate_public_http_url_blocks_ip_literal() -> None:
    with pytest.raises(ValueError, match="ip literal not allowed"):
        validate_public_http_url("https://93.184.216.34/privacy")


def test_validate_public_http_url_blocks_private_ip_dns(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_getaddrinfo(*_args: object, **_kwargs: object) -> list[tuple[object, ...]]:
        return [(0, 0, 0, "", ("10.0.0.1", 443))]

    monkeypatch.setattr(socket, "getaddrinfo", fake_getaddrinfo)
    with pytest.raises(ValueError, match="blocked ip range"):
        validate_public_http_url("https://example.com/privacy")


def test_validate_public_http_url_blocks_userinfo() -> None:
    with pytest.raises(ValueError, match="userinfo not allowed"):
        validate_public_http_url("https://user:pass@example.com/privacy")


def test_validate_public_http_url_blocks_nonstandard_port() -> None:
    with pytest.raises(ValueError, match="non-standard port not allowed"):
        validate_public_http_url("https://example.com:444/privacy")


def test_robots_decision_type() -> None:
    d = RobotsDecision(allowed=True, rule=None)
    assert d.allowed is True
