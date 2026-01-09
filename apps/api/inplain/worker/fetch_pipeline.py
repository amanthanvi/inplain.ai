from __future__ import annotations

import difflib
import hashlib
import io
import ipaddress
import socket
import urllib.robotparser
from datetime import UTC, datetime, timedelta
from urllib.parse import urljoin, urlparse

import httpx
import trafilatura
from lxml import html as lxml_html
from pdfminer.high_level import extract_text as pdf_extract_text
from readability import Document as ReadabilityDocument
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.enums import (
    ChangeEventType,
    DiffFormat,
    DocumentStatus,
    RobotsStatus,
    SnapshotFetchMethod,
    SummaryStatus,
)
from inplain.db.models.jobs import Job
from inplain.db.models.snapshots import Snapshot

_DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_MAX_REDIRECTS = 5
_MAX_RESPONSE_BYTES = 5 * 1024 * 1024
_EXTRACT_VERSION = 2
_RETENTION_DAYS_DEFAULT = 30
_ROBOTS_TTL = timedelta(hours=24)
_DEDUP_WINDOW = timedelta(minutes=5)

_MEANINGFUL_KEYWORDS = {
    "share",
    "sell",
    "third-party",
    "third party",
    "advertising",
    "arbitration",
    "jurisdiction",
    "retention",
    "opt out",
}

_DISCLAIMER = "This summary is informational and not legal advice."


class UnsupportedPdfError(RuntimeError):
    pass


def run_fetch_job(db: Session, job: Job) -> None:
    if job.document_id is None:
        raise RuntimeError("fetch job missing document_id")

    doc = db.execute(select(Document).where(Document.id == job.document_id)).scalar_one_or_none()
    if doc is None:
        raise RuntimeError("document not found")

    if doc.deleted_at is not None:
        return

    now = datetime.now(UTC)

    if doc.last_checked_at is not None and now - doc.last_checked_at < _DEDUP_WINDOW:
        return

    if not _ensure_robots_allowed(db, doc, now):
        doc.last_checked_at = now
        db.add(doc)
        db.commit()
        return

    # Find the previous snapshot (if any).
    prev = (
        db.execute(
            select(Snapshot)
            .where(Snapshot.document_id == doc.id)
            .order_by(Snapshot.fetched_at.desc())
            .limit(1)
        )
        .scalars()
        .first()
    )

    headers: dict[str, str] = {}
    if doc.etag:
        headers["If-None-Match"] = doc.etag
    if doc.last_modified:
        headers["If-Modified-Since"] = doc.last_modified

    url = doc.url_canonical or doc.url
    resp = _http_fetch(url, headers=headers)

    doc.last_checked_at = now

    if resp.status_code == 304:
        db.add(doc)
        db.commit()
        return

    if resp.status_code in (404, 410):
        doc.status = DocumentStatus.paused
        db.add(doc)
        db.commit()
        return

    if resp.status_code >= 400:
        raise RuntimeError(f"http status {resp.status_code}")

    doc.etag = resp.headers.get("etag")
    doc.last_modified = resp.headers.get("last-modified")

    raw_bytes = resp.content
    raw_sha256 = hashlib.sha256(raw_bytes).digest()

    try:
        extracted_text = _extract_text(resp)
    except UnsupportedPdfError:
        doc.status = DocumentStatus.error
        db.add(doc)
        db.commit()
        return
    extracted_bytes = extracted_text.encode("utf-8")
    extracted_sha256 = hashlib.sha256(extracted_bytes).digest()

    if prev is not None and prev.extracted_sha256 == extracted_sha256:
        db.add(doc)
        db.commit()
        return

    snapshot = Snapshot(
        document_id=doc.id,
        fetched_at=now,
        fetch_method=SnapshotFetchMethod.http,
        http_status=resp.status_code,
        final_url=str(resp.url),
        content_type=resp.headers.get("content-type"),
        raw_storage_key=None,
        raw_sha256=raw_sha256,
        extracted_text=extracted_text,
        extracted_sha256=extracted_sha256,
        extract_version=_EXTRACT_VERSION,
        language=None,
        byte_size_raw=len(raw_bytes),
        byte_size_extracted=len(extracted_bytes),
        retention_delete_at=now + timedelta(days=_RETENTION_DAYS_DEFAULT),
    )
    db.add(snapshot)
    db.flush()

    doc.last_snapshot_id = snapshot.id

    if prev is None:
        db.add(doc)
        db.commit()
        return

    unified, hunks, change_score, added_removed_chars = _compute_diff(
        prev.extracted_text, extracted_text
    )
    meaningful = _is_meaningful_change(change_score, added_removed_chars, unified)

    if meaningful:
        diff = Diff(
            document_id=doc.id,
            from_snapshot_id=prev.id,
            to_snapshot_id=snapshot.id,
            diff_format=DiffFormat.unified,
            unified_diff=unified,
            diff_hunks=hunks,
            change_score=change_score,
        )
        db.add(diff)
        db.flush()

        event = ChangeEvent(
            document_id=doc.id,
            diff_id=diff.id,
            event_type=ChangeEventType.meaningful_change,
            title=_default_event_title(doc),
            summary_status=SummaryStatus.pending,
            summary_what_changed=None,
            summary_why_matters=None,
            summary_disclaimer=_DISCLAIMER,
            summary_model=None,
            summary_prompt_version=None,
            summary_error=None,
        )
        db.add(event)
        db.flush()

        doc.last_change_event_id = event.id

    db.add(doc)
    db.commit()


def _http_fetch(url: str, headers: dict[str, str]) -> httpx.Response:
    next_url = url
    for _ in range(_MAX_REDIRECTS + 1):
        _validate_fetch_url(next_url)

        with httpx.Client(
            timeout=httpx.Timeout(20.0, connect=5.0),
            follow_redirects=False,
        ) as client:
            resp = client.get(next_url, headers={"User-Agent": _DEFAULT_USER_AGENT, **headers})

        if resp.status_code in (301, 302, 303, 307, 308) and resp.headers.get("location"):
            next_url = urljoin(str(resp.url), resp.headers["location"])
            continue

        if (
            resp.num_bytes_downloaded is not None
            and resp.num_bytes_downloaded > _MAX_RESPONSE_BYTES
        ):
            raise RuntimeError("response too large")

        if len(resp.content) > _MAX_RESPONSE_BYTES:
            raise RuntimeError("response too large")

        return resp

    raise RuntimeError("too many redirects")


def _validate_fetch_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise RuntimeError("invalid scheme")
    if parsed.username or parsed.password:
        raise RuntimeError("url must not include credentials")
    if parsed.port not in (None, 80, 443):
        raise RuntimeError("disallowed port")
    if not parsed.hostname:
        raise RuntimeError("missing hostname")

    try:
        ipaddress.ip_address(parsed.hostname)
    except ValueError:
        pass
    else:
        raise RuntimeError("ip literal url disallowed")

    _validate_public_hostname(parsed.hostname)


def _validate_public_hostname(hostname: str) -> None:
    try:
        infos = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise RuntimeError("dns resolution failed") from e

    ips: set[str] = set()
    for family, _, _, _, sockaddr in infos:
        if family == socket.AF_INET:
            ips.add(sockaddr[0])
        elif family == socket.AF_INET6:
            ips.add(sockaddr[0])

    for ip_str in ips:
        ip = ipaddress.ip_address(ip_str)
        if not ip.is_global:
            raise RuntimeError("hostname resolves to non-public ip")


def _ensure_robots_allowed(db: Session, doc: Document, now: datetime) -> bool:
    if (
        doc.robots_checked_at is not None
        and now - doc.robots_checked_at < _ROBOTS_TTL
        and doc.robots_status != RobotsStatus.unknown
    ):
        if doc.robots_status != RobotsStatus.allowed:
            doc.status = DocumentStatus.blocked_robots
            db.add(doc)
        return doc.robots_status == RobotsStatus.allowed

    parsed = urlparse(doc.url_canonical or doc.url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
    resp = _http_fetch(robots_url, headers={})

    if resp.status_code == 404:
        doc.robots_checked_at = now
        doc.robots_status = RobotsStatus.allowed
        db.add(doc)
        return True

    if resp.status_code >= 400:
        raise RuntimeError(f"robots fetch failed: status {resp.status_code}")

    rp = urllib.robotparser.RobotFileParser()
    rp.parse(resp.text.splitlines())

    path = parsed.path or "/"
    allowed = rp.can_fetch("*", path)

    doc.robots_checked_at = now
    doc.robots_status = RobotsStatus.allowed if allowed else RobotsStatus.disallowed
    if not allowed:
        doc.status = DocumentStatus.blocked_robots
    db.add(doc)

    return allowed


def _normalize_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = "\n".join(line.rstrip() for line in normalized.split("\n"))
    return normalized.strip()


def _extract_text(resp: httpx.Response) -> str:
    content_type = (resp.headers.get("content-type") or "").lower()
    if not content_type:
        content = resp.text.lstrip()
        looks_like_html = (
            content.startswith("<!doctype")
            or content.startswith("<html")
            or content.startswith("<")
        )
        if looks_like_html:
            content_type = "text/html"
        else:
            content_type = "text/plain"

    if "application/pdf" in content_type or str(resp.url.path).lower().endswith(".pdf"):
        try:
            extracted = pdf_extract_text(io.BytesIO(resp.content))
        except Exception as e:
            raise UnsupportedPdfError("pdf extraction failed") from e

        extracted = _normalize_text(extracted or "")
        if len(extracted) < 500:
            raise UnsupportedPdfError("pdf extraction too small")
        return extracted
    if content_type.startswith("text/plain"):
        return _normalize_text(resp.text)

    if "text/html" in content_type or content_type.endswith("+html"):
        extracted = trafilatura.extract(
            resp.text,
            url=str(resp.url),
            include_comments=False,
            include_tables=False,
            include_links=False,
            include_images=False,
            include_formatting=False,
            favor_precision=True,
            output_format="txt",
        )
        if extracted:
            return _normalize_text(extracted)

        readable = ReadabilityDocument(resp.text).summary(html_partial=True)
        root = lxml_html.fromstring(readable)
        return _normalize_text(root.text_content())

    raise RuntimeError(f"disallowed content-type: {content_type}")


def _compute_diff(
    old_text: str,
    new_text: str,
) -> tuple[str, list[dict], float, int]:
    old_lines = old_text.splitlines()
    new_lines = new_text.splitlines()

    unified_lines = list(
        difflib.unified_diff(old_lines, new_lines, fromfile="from", tofile="to", lineterm="")
    )
    unified = "\n".join(unified_lines)

    hunks: list[dict] = []
    current: dict | None = None
    hunk_idx = 0
    for line in unified_lines:
        if line.startswith("@@"):
            hunk_idx += 1
            current = {"hunkId": f"h{hunk_idx}", "context": "", "added": [], "removed": []}
            hunks.append(current)
            continue

        if current is None:
            continue

        if line.startswith("+++ ") or line.startswith("--- "):
            continue

        if line.startswith("+"):
            current["added"].append(line[1:])
        elif line.startswith("-"):
            current["removed"].append(line[1:])
        elif line.startswith(" "):
            if not current["context"] and line[1:].strip():
                current["context"] = line[1:].strip()[:200]

    change_score = 1.0 - difflib.SequenceMatcher(a=old_text, b=new_text).ratio()
    added_removed_chars = sum(len(s) for h in hunks for s in (h["added"] + h["removed"]))

    return unified, hunks, change_score, added_removed_chars


def _is_meaningful_change(change_score: float, added_removed_chars: int, unified_diff: str) -> bool:
    if added_removed_chars >= 500:
        return True
    if change_score >= 0.02:
        return True

    lower = unified_diff.lower()
    return any(k in lower for k in _MEANINGFUL_KEYWORDS)


def _default_event_title(doc: Document) -> str:
    return f"{doc.doc_type.value.capitalize()} policy updated"
