from __future__ import annotations

import time
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

import trafilatura
from playwright.sync_api import (
    Request,
    Route,
    sync_playwright,
)
from playwright.sync_api import (
    TimeoutError as PlaywrightTimeoutError,
)
from sqlalchemy import select
from sqlalchemy.orm import Session

from inplain.db.models.documents import Document
from inplain.db.models.enums import DocumentStatus, RobotsStatus
from inplain.db.models.jobs import Job
from inplain.worker.handlers.common import (
    check_robots,
    enforce_politeness_delay,
    process_extracted_text,
    validate_public_http_url,
)

_NAV_TIMEOUT_MS = 30_000
_TOTAL_BUDGET_SECONDS = 45

_USER_AGENT = "inplain.ai (+https://inplain.ai)"


def run_render_job(db: Session, *, job: Job) -> None:
    if job.document_id is None:
        raise ValueError("render job missing document_id")

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
            doc.last_checked_at = now
            doc.next_check_at = now + timedelta(days=1)
            db.add(doc)
            db.flush()
            return

        enforce_politeness_delay(doc.url)

        start = time.monotonic()
        html = _render_html(url=doc.url, start=start)

        extracted = trafilatura.extract(html)
        if not extracted:
            raise ValueError("render extraction failed")

        process_extracted_text(
            db,
            doc=doc,
            extracted_text=str(extracted),
            http_status=200,
            content_type="text/html; rendered",
            fetch_method="render",
            now=now,
            robots_status=doc.robots_status,
            robots_rule=doc.robots_rule,
        )

        doc.status = DocumentStatus.active
        doc.last_checked_at = now
        db.add(doc)
    except Exception:
        doc.status = DocumentStatus.error
        doc.last_checked_at = now
        db.add(doc)
        db.commit()
        raise


def _render_html(*, url: str, start: float) -> str:
    allowed_by_host: dict[str, bool] = {}

    def allow_request(req_url: str) -> bool:
        parts = urlsplit(req_url)
        if parts.scheme not in ("http", "https"):
            return False
        if not parts.hostname:
            return False

        cached = allowed_by_host.get(parts.hostname)
        if cached is not None:
            return cached

        try:
            validate_public_http_url(req_url)
        except Exception:  # noqa: BLE001
            allowed_by_host[parts.hostname] = False
            return False

        allowed_by_host[parts.hostname] = True
        return True

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(user_agent=_USER_AGENT, accept_downloads=False)
            try:
                page = context.new_page()
                page.set_default_navigation_timeout(_NAV_TIMEOUT_MS)
                page.set_default_timeout(_NAV_TIMEOUT_MS)

                def route_handler(route: Route, request: Request) -> None:
                    req_url = str(request.url)
                    if allow_request(req_url):
                        route.continue_()
                    else:
                        route.abort()

                page.route("**/*", route_handler)

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=_NAV_TIMEOUT_MS)
                except PlaywrightTimeoutError as exc:
                    raise ValueError("render navigation timeout") from exc

                remaining = _TOTAL_BUDGET_SECONDS - (time.monotonic() - start)
                if remaining > 0:
                    try:
                        page.wait_for_load_state("networkidle", timeout=int(remaining * 1000))
                    except PlaywrightTimeoutError:
                        pass

                return page.content()
            finally:
                context.close()
        finally:
            browser.close()
