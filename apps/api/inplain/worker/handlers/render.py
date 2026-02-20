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
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inplain.db.models.documents import Document
from inplain.db.models.enums import DocumentStatus, JobQueue, JobStatus, RobotsStatus, ScheduleTier
from inplain.db.models.jobs import Job
from inplain.worker.handlers.common import (
    check_robots,
    enforce_politeness_delay,
    process_extracted_text,
    validate_public_http_url,
)

_NAV_TIMEOUT_MS = 30_000
_TOTAL_BUDGET_SECONDS = 45

# Use a browser UA to avoid common WAF blocks on datacenter IPs.
_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


def run_render_job(db: Session, *, job: Job) -> None:
    if job.document_id is None:
        raise ValueError("render job missing document_id")

    doc = db.execute(
        select(Document).where(Document.id == job.document_id, Document.deleted_at.is_(None))
    ).scalar_one()

    now = datetime.now(UTC)

    try:
        validate_public_http_url(doc.url)

        if _over_render_quota(
            db=db,
            clerk_user_id=doc.clerk_user_id,
            schedule_tier=doc.schedule_tier,
        ):
            doc.status = DocumentStatus.error
            doc.last_checked_at = now
            db.add(doc)
            db.flush()
            return

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


def _over_render_quota(*, db: Session, clerk_user_id: str, schedule_tier: ScheduleTier) -> bool:
    now = datetime.now(UTC)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    match schedule_tier:
        case ScheduleTier.daily:
            limit = 20
        case ScheduleTier.six_h:
            limit = 400
        case ScheduleTier.one_h:
            limit = 4000
        case _:
            limit = 20

    used = db.execute(
        select(func.count(Job.id)).where(
            Job.queue == JobQueue.render,
            Job.clerk_user_id == clerk_user_id,
            Job.created_at >= month_start,
            Job.status.in_(
                [
                    JobStatus.queued,
                    JobStatus.running,
                    JobStatus.succeeded,
                    JobStatus.failed,
                    JobStatus.dead,
                ]
            ),
        )
    ).scalar_one()
    return int(used or 0) >= limit


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
