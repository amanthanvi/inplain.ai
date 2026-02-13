from __future__ import annotations

import subprocess
import tempfile
from datetime import UTC, datetime, timedelta
from io import BytesIO
from pathlib import Path
from shutil import which
from urllib.parse import urljoin

import httpx
import pytesseract
import trafilatura
from PIL import Image
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.documents import Document
from inplain.db.models.enums import DocumentStatus, JobQueue, JobStatus, RobotsStatus
from inplain.db.models.jobs import Job
from inplain.worker.handlers.common import (
    check_robots,
    enforce_politeness_delay,
    process_extracted_text,
    validate_public_http_url,
)

_MAX_REDIRECTS = 5
_MAX_RESPONSE_BYTES = 5 * 1024 * 1024
_CONNECT_TIMEOUT_SECONDS = 5
_READ_TIMEOUT_SECONDS = 20

_MIN_EXTRACTED_CHARS = 500


def run_fetch_job(db: Session, job: Job) -> None:
    if job.document_id is None:
        raise ValueError("fetch job missing document_id")

    doc = db.execute(
        select(Document).where(Document.id == job.document_id, Document.deleted_at.is_(None))
    ).scalar_one()

    now = datetime.now(UTC)

    try:
        validate_public_http_url(doc.url)

        decision = check_robots(doc.url)
        doc.robots_checked_at = now
        doc.robots_status = RobotsStatus.allowed if decision.allowed else RobotsStatus.disallowed
        doc.robots_rule = decision.rule if not decision.allowed else None
        if not decision.allowed:
            doc.status = DocumentStatus.blocked_robots
            doc.pause_reason = None
            doc.last_checked_at = now
            doc.next_check_at = now + timedelta(days=1)
            db.add(doc)
            db.flush()
            return

        enforce_politeness_delay(doc.url)

        fetch = _http_fetch(url=doc.url, etag=doc.etag, last_modified=doc.last_modified)
        doc.last_checked_at = now
        doc.etag = fetch.etag
        doc.last_modified = fetch.last_modified

        if fetch.http_status == 304:
            doc.status = DocumentStatus.active
            doc.pause_reason = None
            db.add(doc)
            return

        if fetch.http_status in (404, 410):
            doc.status = DocumentStatus.paused
            doc.pause_reason = "url_inaccessible"
            db.add(doc)
            return

        if fetch.http_status < 200 or fetch.http_status >= 300:
            doc.status = DocumentStatus.error
            doc.pause_reason = None
            db.add(doc)
            return

        extracted_text = _extract_text(fetch.content_bytes, content_type=fetch.content_type)
        if len(extracted_text) < _MIN_EXTRACTED_CHARS:
            _enqueue_render(db=db, doc=doc, now=now)
            doc.status = DocumentStatus.active
            doc.pause_reason = None
            db.add(doc)
            return

        try:
            process_extracted_text(
                db,
                doc=doc,
                extracted_text=extracted_text,
                http_status=fetch.http_status,
                content_type=fetch.content_type,
                fetch_method="http",
                now=now,
                robots_status=doc.robots_status,
                robots_rule=doc.robots_rule,
            )
        except ValueError as exc:
            if str(exc) == "extracted text too small":
                _enqueue_render(db=db, doc=doc, now=now)
                doc.status = DocumentStatus.active
                doc.pause_reason = None
                db.add(doc)
                return
            raise

        doc.status = DocumentStatus.active
        doc.pause_reason = None
        db.add(doc)
    except Exception:
        doc.status = DocumentStatus.error
        doc.pause_reason = None
        doc.last_checked_at = now
        db.add(doc)
        db.commit()
        raise


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
        # Use a browser UA to avoid common WAF blocks on datacenter IPs.
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
    }
    if etag:
        headers["if-none-match"] = etag
    if last_modified:
        headers["if-modified-since"] = last_modified

    timeout = httpx.Timeout(_READ_TIMEOUT_SECONDS, connect=_CONNECT_TIMEOUT_SECONDS)

    with httpx.Client(follow_redirects=False, timeout=timeout) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            resp = client.get(current_url, headers=headers)
            if resp.status_code in (301, 302, 303, 307, 308):
                location = resp.headers.get("location")
                if not location:
                    break
                current_url = urljoin(current_url, location)
                validate_public_http_url(current_url)
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
    return str(extracted).strip()


def _extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(BytesIO(content))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    extracted = "\n".join(parts).strip()
    if len(extracted) >= _MIN_EXTRACTED_CHARS:
        return extracted

    # OCR fallback (best effort): requires pdftoppm + tesseract.
    if which("pdftoppm") and which("tesseract"):
        ocr_text = _ocr_pdf(content)
        ocr_text = ocr_text.strip()
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
