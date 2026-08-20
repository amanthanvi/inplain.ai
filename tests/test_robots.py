"""robots.txt handling: protego's rules, and failing closed."""

from __future__ import annotations

import pytest

from inplain.net import ROBOTS_PRODUCT_TOKEN, TransportError
from inplain.robots import RobotsCache, robots_url_for

from .conftest import response, robots_response

WILDCARDS = """
User-agent: *
Disallow: /*/private/
Disallow: /legal/draft$

User-agent: inplainbot
Disallow: /secret/
Crawl-delay: 7
"""


def cache_for(body: str | None = None, status: int = 200, error: bool = False):
    calls: list[str] = []

    def fetch(url: str):
        calls.append(url)
        if error:
            raise TransportError("connection refused")
        if status == 200:
            return robots_response(url, body or "User-agent: *\nAllow: /\n")
        return response(url, status)

    return RobotsCache(fetch), calls


def test_robots_url_is_derived_from_the_origin():
    assert robots_url_for("https://example.com/a/b?c=d") == "https://example.com/robots.txt"
    assert robots_url_for("http://example.com:8080/a") == "http://example.com:8080/robots.txt"


def test_disallow_for_our_token_blocks():
    cache, _ = cache_for(WILDCARDS)
    assert not cache.check("https://example.com/secret/policy").allowed
    assert cache.check("https://example.com/privacy").allowed


def test_our_own_group_wins_over_the_wildcard_group():
    # The `*` group's /*/private/ rule does not apply once a group names us:
    # that is RFC 9309 group selection, and it is why we use protego.
    cache, _ = cache_for(WILDCARDS)
    assert cache.check("https://example.com/eu/private/x").allowed


def test_wildcard_and_anchor_patterns_are_honoured():
    cache, _ = cache_for("User-agent: *\nDisallow: /*/private/\nDisallow: /legal/draft$\n")
    assert not cache.check("https://example.com/eu/private/x").allowed
    assert not cache.check("https://example.com/legal/draft").allowed
    assert cache.check("https://example.com/legal/drafts").allowed


def test_duplicate_groups_for_the_same_agent_are_merged():
    cache, _ = cache_for(
        "User-agent: *\nDisallow: /a/\n\nUser-agent: *\nDisallow: /b/\n"
    )
    assert not cache.check("https://example.com/a/x").allowed
    assert not cache.check("https://example.com/b/x").allowed


def test_crawl_delay_is_read_for_our_token():
    cache, _ = cache_for(WILDCARDS)
    assert cache.crawl_delay("https://example.com/privacy") == 7.0


@pytest.mark.parametrize("status", [500, 502, 503, 429, 301])
def test_a_server_error_means_disallow(status):
    # Fail closed. v0.2.0 read 5xx as allow-all.
    cache, _ = cache_for(status=status)
    decision = cache.check("https://example.com/privacy")
    assert not decision.allowed
    assert str(status) in decision.reason


def test_an_unreachable_robots_txt_means_disallow():
    cache, _ = cache_for(error=True)
    assert not cache.check("https://example.com/privacy").allowed


@pytest.mark.parametrize("status", [404, 403, 410])
def test_missing_robots_txt_allows(status):
    cache, _ = cache_for(status=status)
    assert cache.check("https://example.com/privacy").allowed


def test_robots_is_fetched_once_per_origin():
    cache, calls = cache_for(WILDCARDS)
    cache.check("https://example.com/a")
    cache.check("https://example.com/b")
    cache.crawl_delay("https://example.com/c")
    cache.check("https://other.test/a")
    assert calls == ["https://example.com/robots.txt", "https://other.test/robots.txt"]


def test_the_product_token_is_the_crawler_identity():
    cache, _ = cache_for()
    assert cache.product_token == ROBOTS_PRODUCT_TOKEN
