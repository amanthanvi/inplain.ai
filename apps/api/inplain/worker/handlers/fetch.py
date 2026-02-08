from __future__ import annotations

import hashlib
import ipaddress
import socket
import subprocess
import tempfile
import threading
from datetime import UTC, datetime, timedelta
from difflib import SequenceMatcher
from io import BytesIO
from pathlib import Path
from shutil import which
from urllib import robotparser
from urllib.parse import urljoin, urlsplit

import httpx
import pytesseract
import trafilatura
from diff_match_patch import diff_match_patch
from PIL import Image
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.enums import DocumentStatus, JobQueue, JobStatus, RobotsStatus, ScheduleTier
from inplain.db.models.jobs import Job
from inplain.db.models.snapshots import Snapshot

_MAX_REDIRECTS = 5
_MAX_RESPONSE_BYTES = 5 * 1024 * 1024
_CONNECT_TIMEOUT_SECONDS = 5
_READ_TIMEOUT_SECONDS = 20

_MIN_EXTRACTED_CHARS = 500
_RETENTION_BY_SCHEDULE: dict[ScheduleTier, timedelta] = {
    ScheduleTier.daily: timedelta(days=90),
    ScheduleTier.six_h: timedelta(days=365),
    ScheduleTier.one_h: timedelta(days=365 * 2),
}

_ROBOTS_CACHE_TTL = timedelta(hours=24)
_robots_cache_lock = threading.Lock()
_robots_cache: dict[str, tuple[datetime, bool]] = {}


def run_fetch_job(db: Session, job: Job) -> None:
    if job.document_id is None:
        raise ValueError("fetch job missing document_id")

    doc = db.execute(
        select(Document).where(Document.id == job.document_id, Document.deleted_at.is_(None))
    ).scalar_one()

    now = datetime.now(UTC)

    _validate_public_http_url(doc.url)

    robots_allowed = _robots_allows(url=doc.url)
    doc.robots_checked_at = now
    doc.robots_status = RobotsStatus.allowed if robots_allowed else RobotsStatus.disallowed
    if not robots_allowed:
        doc.status = DocumentStatus.blocked_robots
        doc.last_checked_at = now
        db.add(doc)
        return

    prev_snapshot_id = doc.last_snapshot_id

    fetch = _http_fetch(url=doc.url, etag=doc.etag, last_modified=doc.last_modified)
    doc.last_checked_at = now
    doc.etag = fetch.etag
    doc.last_modified = fetch.last_modified

    if fetch.http_status == 304:
        db.add(doc)
        return

    if fetch.http_status in (404, 410):
        doc.status = DocumentStatus.paused
        db.add(doc)
        return

    if fetch.http_status < 200 or fetch.http_status >= 300:
        doc.status = DocumentStatus.error
        db.add(doc)
        return

    extracted_text = _extract_text(fetch.content_bytes, content_type=fetch.content_type)
    if len(extracted_text) < _MIN_EXTRACTED_CHARS:
        _enqueue_render(db=db, doc=doc, now=now)
        db.add(doc)
        return

    extracted_sha = hashlib.sha256(extracted_text.encode("utf-8")).hexdigest()

    if prev_snapshot_id is not None:
        prev_sha = db.execute(
            select(Snapshot.extracted_sha256).where(Snapshot.id == prev_snapshot_id)
        ).scalar_one_or_none()
        if prev_sha == extracted_sha:
            db.add(doc)
            return

    retention = _RETENTION_BY_SCHEDULE.get(doc.schedule_tier, timedelta(days=90))
    snapshot = Snapshot(
        document_id=doc.id,
        fetched_at=now,
        fetch_method="http",
        http_status=fetch.http_status,
        content_type=fetch.content_type,
        extracted_text=extracted_text,
        extracted_sha256=extracted_sha,
        extract_version=1,
        byte_size_extracted=len(extracted_text.encode("utf-8")),
        retention_delete_at=now + retention,
    )
    db.add(snapshot)
    db.flush()

    doc.last_snapshot_id = snapshot.id
    doc.status = DocumentStatus.active
    db.add(doc)

    if prev_snapshot_id is None:
        return

    prev_text = db.execute(
        select(Snapshot.extracted_text).where(Snapshot.id == prev_snapshot_id)
    ).scalar_one_or_none()
    if prev_text is None:
        return

    ratio = SequenceMatcher(None, prev_text, extracted_text).ratio()
    change_score = max(0.0, min(1.0, 1.0 - ratio))

    dmp = diff_match_patch()
    diffs = dmp.diff_main(prev_text, extracted_text)
    dmp.diff_cleanupSemantic(diffs)
    changed_chars = sum(len(t) for op, t in diffs if op != 0)

    if changed_chars < 500 and change_score < 0.02:
        return

    existing_diff = db.execute(
        select(Diff.id).where(
            Diff.from_snapshot_id == prev_snapshot_id,
            Diff.to_snapshot_id == snapshot.id,
        )
    ).scalar_one_or_none()
    if existing_diff is not None:
        return

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


def _enqueue_render(db: Session, doc: Document, now: datetime) -> None:
    existing = db.execute(
        select(Job.id).where(
            Job.queue == JobQueue.render,
            Job.document_id == doc.id,
            Job.status.in_([JobStatus.queued, JobStatus.running]),
        )
    ).scalar_one_or_none()
    if existing is not None:
        return
    db.add(
        Job(
            queue=JobQueue.render,
            clerk_user_id=doc.clerk_user_id,
            document_id=doc.id,
            status=JobStatus.queued,
            run_at=now,
        )
    )


class _FetchResult:
    def __init__(
        self,
        *,
        http_status: int,
        content_type: str | None,
        content_bytes: bytes,
        etag: str | None,
        last_modified: str | None,
    ):
        self.http_status = http_status
        self.content_type = content_type
        self.content_bytes = content_bytes
        self.etag = etag
        self.last_modified = last_modified


def _http_fetch(url: str, etag: str | None, last_modified: str | None) -> _FetchResult:
    current_url = url
    headers: dict[str, str] = {
        "user-agent": "inplain.ai (+https://inplain.ai)",
        "accept": "*/*",
    }
    if etag:
        headers["if-none-match"] = etag
    if last_modified:
        headers["if-modified-since"] = last_modified

    timeout = httpx.Timeout(connect=_CONNECT_TIMEOUT_SECONDS, read=_READ_TIMEOUT_SECONDS)

    with httpx.Client(follow_redirects=False, timeout=timeout) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            resp = client.get(current_url, headers=headers)
            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("location")
                if not location:
                    break
                current_url = urljoin(current_url, location)
                _validate_public_http_url(current_url)
                continue

            content = resp.content
            if len(content) > _MAX_RESPONSE_BYTES:
                raise ValueError("response too large")

            return _FetchResult(
                http_status=resp.status_code,
                content_type=resp.headers.get("content-type"),
                content_bytes=content,
                etag=resp.headers.get("etag"),
                last_modified=resp.headers.get("last-modified"),
            )

    raise ValueError("too many redirects")


def _extract_text(content: bytes, content_type: str | None) -> str:
    if content_type and "pdf" in content_type.lower():
        return _extract_pdf_text(content)

    html = content.decode("utf-8", errors="ignore")
    extracted = trafilatura.extract(html)
    if not extracted:
        raise ValueError("extraction failed")
    return _strip_cosmetic(extracted)


def _extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(BytesIO(content))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    extracted = _strip_cosmetic("\n".join(parts))
    if len(extracted) >= _MIN_EXTRACTED_CHARS:
        return extracted

    # OCR fallback (best effort): requires pdftoppm + tesseract.
    if which("pdftoppm") and which("tesseract"):
        ocr_text = _ocr_pdf(content)
        ocr_text = _strip_cosmetic(ocr_text)
        if len(ocr_text) >= _MIN_EXTRACTED_CHARS:
            return ocr_text

    raise ValueError("pdf text too small and OCR unavailable")


def _ocr_pdf(content: bytes) -> str:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        pdf_path = tmp / "doc.pdf"
        pdf_path.write_bytes(content)

        prefix = str(tmp / "page")
        subprocess.run(
            ["pdftoppm", "-png", str(pdf_path), prefix],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=45,
        )

        parts: list[str] = []
        for png in sorted(tmp.glob("page-*.png")):
            with Image.open(png) as img:
                parts.append(pytesseract.image_to_string(img))
        return "\n".join(parts)


def _strip_cosmetic(text: str) -> str:
    # Minimal normalizer; refined later.
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()


def _robots_allows(url: str) -> bool:
    parts = urlsplit(url)
    if not parts.scheme or not parts.hostname:
        return False

    cache_key = f"{parts.scheme}://{parts.hostname}"
    now = datetime.now(UTC)

    with _robots_cache_lock:
        cached = _robots_cache.get(cache_key)
        if cached and now - cached[0] < _ROBOTS_CACHE_TTL:
            return cached[1]

    robots_url = f"{cache_key}/robots.txt"
    timeout = httpx.Timeout(connect=_CONNECT_TIMEOUT_SECONDS, read=_READ_TIMEOUT_SECONDS)
    allowed = True
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(robots_url, headers={"user-agent": "inplain.ai (+https://inplain.ai)"})
            if resp.status_code >= 400:
                allowed = True
            else:
                rp = robotparser.RobotFileParser()
                rp.parse(resp.text.splitlines())
                allowed = bool(rp.can_fetch("inplain.ai", url))
    except Exception:  # noqa: BLE001
        allowed = True

    with _robots_cache_lock:
        _robots_cache[cache_key] = (now, allowed)

    return allowed


def _validate_public_http_url(url: str) -> None:
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
