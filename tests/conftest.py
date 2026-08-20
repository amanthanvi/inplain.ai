"""Test doubles. No test in this suite is allowed to touch the network.

The crawler takes its transport and its DNS resolver as arguments, so the
fakes below replace the network at the same seam the real one plugs into:
every rule the crawler enforces (robots, redirects, addresses, politeness,
conditional GET) runs for real against them.
"""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

import pytest
from requests.structures import CaseInsensitiveDict

from inplain.net import HttpResponse, TransportError

PUBLIC_IP = "93.184.216.34"

PARAGRAPH = (
    "We collect the information you give us when you use the service, "
    "including your name, your email address and the pages you visit. "
)


def policy_html(body: str = "", *, title: str = "Privacy Policy") -> bytes:
    """A page trafilatura extracts well over the 500-character floor."""
    prose = body or PARAGRAPH * 4
    return (
        f"<html><head><title>{title}</title></head><body>"
        "<nav>Home About Contact</nav>"
        f"<article><h1>{title}</h1><p>{prose}</p>"
        f"<p>{PARAGRAPH * 3}</p></article>"
        "<footer>(c) 2026</footer></body></html>"
    ).encode("utf-8")


def response(
    url: str,
    status: int = 200,
    headers: dict[str, str] | None = None,
    body: bytes = b"",
) -> HttpResponse:
    return HttpResponse(url, status, CaseInsensitiveDict(headers or {}), body)


def html_response(url: str, body: bytes | None = None, **headers: str) -> HttpResponse:
    merged = {"Content-Type": "text/html; charset=utf-8", **headers}
    return response(url, 200, merged, body if body is not None else policy_html())


def robots_response(url: str, text: str = "User-agent: *\nAllow: /\n") -> HttpResponse:
    return response(
        url, 200, {"Content-Type": "text/plain"}, text.encode("utf-8")
    )


def redirect_response(url: str, location: str, status: int = 302) -> HttpResponse:
    return response(url, status, {"Location": location})


def not_modified(url: str, **headers: str) -> HttpResponse:
    return response(url, 304, headers)


@dataclass
class Recorded:
    url: str
    ip: str
    host: str
    headers: dict[str, str]
    max_bytes: int


class FakeTransport:
    """Serves scripted responses per absolute URL and records every request."""

    def __init__(self, routes: dict | None = None) -> None:
        self.routes: dict = dict(routes or {})
        self.requests: list[Recorded] = []

    def route(self, url: str, handler) -> None:
        self.routes[url] = handler

    def get(self, target, headers, timeout=30.0, max_bytes=5 * 1024 * 1024):
        self.requests.append(
            Recorded(target.url, target.ip, target.host, dict(headers), max_bytes)
        )
        handler = self.routes.get(target.url)
        if handler is None:
            raise TransportError(f"no route for {target.url}")
        if callable(handler):
            return handler(target, headers)
        return handler

    @property
    def urls(self) -> list[str]:
        return [r.url for r in self.requests]

    def requests_for(self, url: str) -> list[Recorded]:
        return [r for r in self.requests if r.url == url]


def resolver_for(mapping: dict[str, list[str]] | None = None, default: str = PUBLIC_IP):
    """A DNS stub. Unknown hosts resolve to a public address."""

    table = dict(mapping or {})

    def resolve(host: str) -> list[str]:
        return list(table.get(host, [default]))

    return resolve


@dataclass
class SleepRecorder:
    calls: list[float] = field(default_factory=list)

    def __call__(self, seconds: float) -> None:
        self.calls.append(seconds)


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(root), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return result.stdout


CATALOG = [
    {
        "slug": "example",
        "name": "Example",
        "website_url": "https://example.com",
        "category": "other",
        "policy_urls": {"privacy": "https://example.com/privacy"},
    },
    {
        "slug": "other",
        "name": "Other Co",
        "website_url": "https://other.test",
        "category": "other",
        "policy_urls": {"tos": "https://other.test/terms"},
    },
]


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A real git repository, because git is the datastore under test."""
    root = tmp_path / "repo"
    root.mkdir()
    git(root, "init", "-b", "main")
    git(root, "config", "user.email", "crawler@inplain.test")
    git(root, "config", "user.name", "inplain test")
    git(root, "config", "commit.gpgsign", "false")
    (root / "catalog.json").write_text(
        json.dumps(CATALOG, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    git(root, "add", "catalog.json")
    git(root, "commit", "-m", "seed catalog")
    return root


def commit_count(root: Path) -> int:
    return int(git(root, "rev-list", "--count", "HEAD").strip())


def files_in_commit(root: Path, ref: str = "HEAD") -> list[str]:
    out = git(root, "show", "--pretty=format:", "--name-only", ref)
    return [line.strip() for line in out.splitlines() if line.strip()]
