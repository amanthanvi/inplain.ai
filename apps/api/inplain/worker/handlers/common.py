from __future__ import annotations

import hashlib
import ipaddress
import re
import socket
import threading
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import urlsplit

import httpx
from diff_match_patch import diff_match_patch
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.enums import JobQueue, JobStatus, RobotsStatus, ScheduleTier
from inplain.db.models.jobs import Job
from inplain.db.models.snapshots import Snapshot
from inplain.settings import settings

_CONNECT_TIMEOUT_SECONDS = 5
_READ_TIMEOUT_SECONDS = 20

_MIN_EXTRACTED_CHARS = 500
_CHANGE_SCORE_THRESHOLD = 0.02
_MIN_CHANGED_CHARS = 500

_RETENTION_BY_SCHEDULE: dict[ScheduleTier, timedelta] = {
    ScheduleTier.daily: timedelta(days=90),
    ScheduleTier.six_h: timedelta(days=365),
    ScheduleTier.one_h: timedelta(days=365 * 2),
}

_ROBOTS_CACHE_TTL = timedelta(hours=24)
_robots_cache_lock = threading.Lock()
_robots_txt_cache: dict[str, tuple[datetime, str]] = {}

_ROBOTS_USER_AGENT = "inplain.ai"
_ROBOTS_HEADER_UA = "inplain.ai (+https://inplain.ai)"

_POLITE_DELAY = timedelta(seconds=2)
_polite_lock = threading.Lock()
_polite_last_by_host: dict[str, datetime] = {}

_REDIS_LOCK = threading.Lock()
_REDIS_CLIENT: Redis | None = None

_REDIS_ROBOTS_TXT_PREFIX = "inplain:robots:txt:"
_REDIS_POLITE_PREFIX = "inplain:polite:last:"

_COSMETIC_LINE_PATTERNS = [
    re.compile(r"^\s*©\s*\d{4}.*$", re.IGNORECASE),
    re.compile(r"^\s*copyright\b.*\d{4}.*$", re.IGNORECASE),
    re.compile(r"^\s*page\s+\d+(\s+of\s+\d+)?\s*$", re.IGNORECASE),
    re.compile(
        r"^\s*(last\s+updated|last\s+modified|updated|effective\s+date|effective)\b.*$",
        re.IGNORECASE,
    ),
]


def strip_cosmetic(text: str) -> str:
    lines: list[str] = []
    blank_run = 0
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if any(p.match(line) for p in _COSMETIC_LINE_PATTERNS):
            continue

        if not line.strip():
            blank_run += 1
            if blank_run > 2:
                continue
            lines.append("")
            continue

        blank_run = 0
        lines.append(line)

    return "\n".join(lines).strip()


def retention_for_schedule(tier: ScheduleTier) -> timedelta:
    return _RETENTION_BY_SCHEDULE.get(tier, timedelta(days=90))


def enforce_politeness_delay(url: str) -> None:
    parts = urlsplit(url)
    hostname = parts.hostname
    if not hostname:
        return

    now = datetime.now(UTC)
    redis_client = _get_redis()
    if redis_client is not None:
        try:
            key = f"{_REDIS_POLITE_PREFIX}{hostname}"
            prev = redis_client.get(key)
            if prev:
                prev_dt = datetime.fromtimestamp(float(prev), tz=UTC)
                elapsed = now - prev_dt
                if elapsed < _POLITE_DELAY:
                    time.sleep((_POLITE_DELAY - elapsed).total_seconds())
            redis_client.set(key, str(datetime.now(UTC).timestamp()))
            return
        except RedisError:
            pass

    sleep_for: float | None = None
    with _polite_lock:
        prev_dt = _polite_last_by_host.get(hostname)
        if prev_dt is not None:
            elapsed = now - prev_dt
            if elapsed < _POLITE_DELAY:
                sleep_for = (_POLITE_DELAY - elapsed).total_seconds()
        _polite_last_by_host[hostname] = now

    if sleep_for:
        time.sleep(sleep_for)


def validate_public_http_url(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise ValueError("invalid scheme")
    if parts.username or parts.password:
        raise ValueError("userinfo not allowed")
    if not parts.hostname:
        raise ValueError("missing hostname")

    hostname = parts.hostname
    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        pass
    else:
        raise ValueError("ip literal not allowed")

    if parts.port is not None:
        if parts.scheme == "http" and parts.port != 80:
            raise ValueError("non-standard port not allowed")
        if parts.scheme == "https" and parts.port != 443:
            raise ValueError("non-standard port not allowed")

    addrs = socket.getaddrinfo(hostname, parts.port or (443 if parts.scheme == "https" else 80))
    for _, _, _, _, sockaddr in addrs:
        ip = sockaddr[0]
        ip_obj = ipaddress.ip_address(ip)
        if (
            ip_obj.is_private
            or ip_obj.is_loopback
            or ip_obj.is_link_local
            or ip_obj.is_multicast
            or ip_obj.is_reserved
            or ip_obj.is_unspecified
            or ip == "169.254.169.254"
        ):
            raise ValueError("blocked ip range")


@dataclass(frozen=True)
class RobotsDecision:
    allowed: bool
    rule: str | None


def check_robots(url: str) -> RobotsDecision:
    parts = urlsplit(url)
    if not parts.scheme or not parts.hostname:
        return RobotsDecision(allowed=False, rule="invalid url")

    cache_key = f"{parts.scheme}://{parts.hostname}"
    robots_txt = _get_cached_robots_txt(cache_key)
    if robots_txt is None:
        robots_txt = _fetch_robots_txt(cache_key)
        _store_cached_robots_txt(cache_key, robots_txt)

    if not robots_txt:
        return RobotsDecision(allowed=True, rule=None)

    path = parts.path or "/"
    return _evaluate_robots(robots_txt=robots_txt, path=path, user_agent=_ROBOTS_USER_AGENT)


def _get_redis() -> Redis | None:
    if not settings.redis_url:
        return None

    global _REDIS_CLIENT  # noqa: PLW0603
    with _REDIS_LOCK:
        if _REDIS_CLIENT is None:
            _REDIS_CLIENT = Redis.from_url(settings.redis_url, decode_responses=True)
    return _REDIS_CLIENT


def _get_cached_robots_txt(cache_key: str) -> str | None:
    now = datetime.now(UTC)
    with _robots_cache_lock:
        cached = _robots_txt_cache.get(cache_key)
        if cached and now - cached[0] < _ROBOTS_CACHE_TTL:
            return cached[1]

    redis_client = _get_redis()
    if redis_client is None:
        return None

    try:
        val = redis_client.get(f"{_REDIS_ROBOTS_TXT_PREFIX}{cache_key}")
        if isinstance(val, str):
            with _robots_cache_lock:
                _robots_txt_cache[cache_key] = (now, val)
            return val
    except RedisError:
        return None

    return None


def _store_cached_robots_txt(cache_key: str, robots_txt: str) -> None:
    now = datetime.now(UTC)
    with _robots_cache_lock:
        _robots_txt_cache[cache_key] = (now, robots_txt)

    redis_client = _get_redis()
    if redis_client is None:
        return

    try:
        redis_client.setex(
            f"{_REDIS_ROBOTS_TXT_PREFIX}{cache_key}",
            int(_ROBOTS_CACHE_TTL.total_seconds()),
            robots_txt,
        )
    except RedisError:
        return


def _fetch_robots_txt(cache_key: str) -> str:
    robots_url = f"{cache_key}/robots.txt"
    timeout = httpx.Timeout(connect=_CONNECT_TIMEOUT_SECONDS, read=_READ_TIMEOUT_SECONDS)
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(robots_url, headers={"user-agent": _ROBOTS_HEADER_UA})
            if resp.status_code >= 400:
                return ""
            return str(resp.text)
    except Exception:  # noqa: BLE001
        return ""


@dataclass(frozen=True)
class _RobotsRule:
    kind: str  # "allow" | "disallow"
    path: str


@dataclass(frozen=True)
class _RobotsGroup:
    agents: list[str]
    rules: list[_RobotsRule]


def _evaluate_robots(*, robots_txt: str, path: str, user_agent: str) -> RobotsDecision:
    groups = _parse_robots_groups(robots_txt)
    if not groups:
        return RobotsDecision(allowed=True, rule=None)

    ua = user_agent.lower()
    best_group: _RobotsGroup | None = None
    best_match = -1
    for g in groups:
        match_len = _match_user_agent_len(ua=ua, agents=g.agents)
        if match_len > best_match:
            best_match = match_len
            best_group = g

    if best_group is None or best_match < 0:
        return RobotsDecision(allowed=True, rule=None)

    best_rule: _RobotsRule | None = None
    for r in best_group.rules:
        if path.startswith(r.path):
            if best_rule is None or len(r.path) > len(best_rule.path):
                best_rule = r
            elif best_rule is not None and len(r.path) == len(best_rule.path):
                if best_rule.kind == "disallow" and r.kind == "allow":
                    best_rule = r

    if best_rule is None:
        return RobotsDecision(allowed=True, rule=None)

    if best_rule.kind == "disallow" and best_rule.path:
        return RobotsDecision(allowed=False, rule=f"Disallow: {best_rule.path}")

    return RobotsDecision(allowed=True, rule=None)


def _match_user_agent_len(*, ua: str, agents: list[str]) -> int:
    best = -1
    for a in agents:
        a_norm = a.lower()
        if a_norm == "*":
            best = max(best, 0)
            continue
        if ua.startswith(a_norm):
            best = max(best, len(a_norm))
    return best


def _parse_robots_groups(robots_txt: str) -> list[_RobotsGroup]:
    groups: list[_RobotsGroup] = []

    agents: list[str] = []
    rules: list[_RobotsRule] = []
    seen_rule = False

    for raw in robots_txt.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue

        key, sep, value = line.partition(":")
        if not sep:
            continue

        directive = key.strip().lower()
        data = value.strip()

        if directive == "user-agent":
            if seen_rule and agents:
                groups.append(_RobotsGroup(agents=agents, rules=rules))
                agents = []
                rules = []
                seen_rule = False
            if data:
                agents.append(data)
            continue

        if directive in ("allow", "disallow"):
            seen_rule = True
            rules.append(_RobotsRule(kind=directive, path=data))

    if agents:
        groups.append(_RobotsGroup(agents=agents, rules=rules))

    return groups


def process_extracted_text(
    db: Session,
    *,
    doc: Document,
    extracted_text: str,
    http_status: int,
    content_type: str | None,
    fetch_method: str,
    now: datetime,
    robots_status: RobotsStatus,
    robots_rule: str | None,
) -> Snapshot | None:
    extracted_text = strip_cosmetic(extracted_text)
    if len(extracted_text) < _MIN_EXTRACTED_CHARS:
        raise ValueError("extracted text too small")

    extracted_sha = hashlib.sha256(extracted_text.encode("utf-8")).hexdigest()
    prev_snapshot_id = doc.last_snapshot_id

    if prev_snapshot_id is not None:
        prev_sha = db.execute(
            select(Snapshot.extracted_sha256).where(Snapshot.id == prev_snapshot_id)
        ).scalar_one_or_none()
        if prev_sha == extracted_sha:
            return None

    retention = _RETENTION_BY_SCHEDULE.get(doc.schedule_tier, timedelta(days=90))
    snapshot = Snapshot(
        document_id=doc.id,
        fetched_at=now,
        fetch_method=fetch_method,
        http_status=http_status,
        content_type=content_type,
        extracted_text=extracted_text,
        extracted_sha256=extracted_sha,
        extract_version=1,
        byte_size_extracted=len(extracted_text.encode("utf-8")),
        retention_delete_at=now + retention,
    )
    db.add(snapshot)
    db.flush()

    doc.last_snapshot_id = snapshot.id
    doc.robots_status = robots_status
    doc.robots_rule = robots_rule
    db.add(doc)

    if prev_snapshot_id is None:
        return snapshot

    prev_text = db.execute(
        select(Snapshot.extracted_text).where(Snapshot.id == prev_snapshot_id)
    ).scalar_one_or_none()
    if prev_text is None:
        return snapshot

    ratio = SequenceMatcher(None, prev_text, extracted_text).ratio()
    change_score = max(0.0, min(1.0, 1.0 - ratio))

    dmp = diff_match_patch()
    diffs = dmp.diff_main(prev_text, extracted_text)
    dmp.diff_cleanupSemantic(diffs)
    changed_chars = sum(len(t) for op, t in diffs if op != 0)

    if changed_chars < _MIN_CHANGED_CHARS and change_score < _CHANGE_SCORE_THRESHOLD:
        return snapshot

    existing_diff = db.execute(
        select(Diff.id).where(
            Diff.from_snapshot_id == prev_snapshot_id,
            Diff.to_snapshot_id == snapshot.id,
        )
    ).scalar_one_or_none()
    if existing_diff is not None:
        return snapshot

    db.add(
        Job(
            queue=JobQueue.diff,
            clerk_user_id=doc.clerk_user_id,
            document_id=doc.id,
            status=JobStatus.queued,
            run_at=now,
            payload={
                "from_snapshot_id": str(prev_snapshot_id),
                "to_snapshot_id": str(snapshot.id),
                "change_score": change_score,
                "changed_chars": changed_chars,
            },
        )
    )

    return snapshot


def hunk_text_for_citations(diff_hunks: list[dict[str, Any]]) -> dict[str, str]:
    by_id: dict[str, str] = {}
    for h in diff_hunks:
        hid = str(h.get("hunkId") or "")
        added = "".join(h.get("added") or [])
        removed = "".join(h.get("removed") or [])
        by_id[hid] = added + "\n" + removed
    return by_id
