"""robots.txt, via protego, fetched once per origin and cached.

Two rules carry the weight here:

* the product token we evaluate against is derived from the User-Agent we
  actually send (``inplain.net.USER_AGENT``), so an origin can write a rule
  for us and have it apply;
* anything short of a clean answer is a **disallow**. A 5xx, a timeout, a
  refused connection or an unparseable file all fail closed. v0.2.0 treated
  5xx as allow-all, which is the wrong direction to fail on someone else's
  server.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlsplit, urlunsplit

from protego import Protego

from .net import ROBOTS_PRODUCT_TOKEN, FetchError, HttpResponse

ROBOTS_MAX_BYTES = 512 * 1024
# 4xx normally means "no robots.txt, no restrictions", but these two say the
# origin is rationing us, not that it has nothing to say. Treated as unknown,
# which here means disallow.
RATE_LIMIT_STATUSES = frozenset({408, 429})


@dataclass(frozen=True)
class Decision:
    allowed: bool
    reason: str


@dataclass(frozen=True)
class _Rules:
    parser: Protego | None
    fallback: bool  # used when there is no parser: allow-all or deny-all
    reason: str

    def can_fetch(self, url: str, token: str) -> bool:
        if self.parser is None:
            return self.fallback
        return bool(self.parser.can_fetch(url, token))

    def crawl_delay(self, token: str) -> float | None:
        if self.parser is None:
            return None
        delay = self.parser.crawl_delay(token)
        return float(delay) if delay is not None else None


def origin_of(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, "", "", ""))


def robots_url_for(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, "/robots.txt", "", ""))


class RobotsCache:
    """Per-origin robots.txt rules for one crawl run.

    ``fetch`` performs a fetch that does *not* consult robots (that would not
    terminate) but does validate the address and honour politeness.
    """

    def __init__(
        self,
        fetch: Callable[[str], HttpResponse],
        product_token: str = ROBOTS_PRODUCT_TOKEN,
    ) -> None:
        self._fetch = fetch
        self._token = product_token
        self._rules: dict[str, _Rules] = {}

    @property
    def product_token(self) -> str:
        return self._token

    def rules_for(self, url: str) -> _Rules:
        origin = origin_of(url)
        cached = self._rules.get(origin)
        if cached is None:
            cached = self._load(origin)
            self._rules[origin] = cached
        return cached

    def check(self, url: str) -> Decision:
        rules = self.rules_for(url)
        if rules.can_fetch(url, self._token):
            return Decision(True, rules.reason)
        return Decision(False, f"robots.txt disallows {self._token}: {rules.reason}")

    def crawl_delay(self, url: str) -> float | None:
        return self.rules_for(url).crawl_delay(self._token)

    def _load(self, origin: str) -> _Rules:
        url = robots_url_for(origin)
        try:
            response = self._fetch(url)
        except FetchError as exc:
            return _Rules(None, False, f"{url} could not be fetched ({exc})")

        status = response.status
        if 200 <= status < 300:
            text = response.body.decode("utf-8", errors="replace")
            try:
                return _Rules(Protego.parse(text), False, f"{url} {status}")
            except Exception as exc:  # pragma: no cover - protego is forgiving
                return _Rules(None, False, f"{url} could not be parsed ({exc})")
        if 400 <= status < 500 and status not in RATE_LIMIT_STATUSES:
            # RFC 9309 §2.3.1.3: unavailable means no restrictions.
            return _Rules(None, True, f"{url} {status} (no robots.txt)")
        # 5xx, 3xx that never resolved, anything else: fail closed.
        return _Rules(None, False, f"{url} {status} (treated as disallow)")
