from __future__ import annotations

import hashlib
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from inplain.db.models.change_events import ChangeEvent
from inplain.db.models.diffs import Diff
from inplain.db.models.documents import Document
from inplain.db.models.entitlements import Entitlement
from inplain.db.models.enums import (
    ChangeEventType,
    DiffFormat,
    JobStatus,
    JobType,
    Provider,
    ProviderAction,
    SnapshotFetchMethod,
    SummaryStatus,
)
from inplain.db.models.jobs import Job
from inplain.db.models.provider_usage import ProviderUsage
from inplain.db.models.snapshots import Snapshot
from inplain.storage.s3 import upload_snapshot_raw
from inplain.worker.fetch_pipeline import (
    _DEDUP_WINDOW,
    _DEFAULT_USER_AGENT,
    _EXTRACT_VERSION,
    _MAX_RESPONSE_BYTES,
    _compute_diff,
    _default_event_title,
    _ensure_robots_allowed,
    _extract_text,
    _is_meaningful_change,
    _retention_days_for_user,
    _validate_fetch_url,
)


def run_render_job(db: Session, job: Job) -> None:
    if job.document_id is None:
        raise RuntimeError("render job missing document_id")

    doc = db.execute(select(Document).where(Document.id == job.document_id)).scalar_one_or_none()
    if doc is None or doc.deleted_at is not None:
        return

    now = datetime.now(UTC)
    if doc.last_checked_at is not None and now - doc.last_checked_at < _DEDUP_WINDOW:
        return

    if not _ensure_robots_allowed(db, doc, now):
        doc.last_checked_at = now
        db.add(doc)
        db.commit()
        return

    period_key = now.strftime("%Y-%m")
    if not _has_render_quota(db, user_id=doc.user_id, period_key=period_key):
        doc.last_checked_at = now
        db.add(doc)
        db.commit()
        return

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

    url = doc.url_canonical or doc.url
    status_code, final_url, content_type, raw_bytes = _playwright_fetch(url)

    doc.last_checked_at = now

    if len(raw_bytes) > _MAX_RESPONSE_BYTES:
        raise RuntimeError("response too large")

    raw_sha256 = hashlib.sha256(raw_bytes).digest()
    resp = httpx.Response(
        status_code=status_code,
        headers={"content-type": content_type} if content_type else {},
        content=raw_bytes,
        request=httpx.Request("GET", final_url),
    )

    extracted_text = _extract_text(resp)
    extracted_bytes = extracted_text.encode("utf-8")
    extracted_sha256 = hashlib.sha256(extracted_bytes).digest()

    if prev is not None and prev.extracted_sha256 == extracted_sha256:
        db.add(doc)
        db.commit()
        return

    retention_days = _retention_days_for_user(db=db, user_id=doc.user_id)
    snapshot = Snapshot(
        document_id=doc.id,
        fetched_at=now,
        fetch_method=SnapshotFetchMethod.render,
        http_status=status_code,
        final_url=final_url,
        content_type=content_type,
        raw_storage_key=None,
        raw_sha256=raw_sha256,
        extracted_text=extracted_text,
        extracted_sha256=extracted_sha256,
        extract_version=_EXTRACT_VERSION,
        language=None,
        byte_size_raw=len(raw_bytes),
        byte_size_extracted=len(extracted_bytes),
        retention_delete_at=now + timedelta(days=retention_days),
    )
    db.add(snapshot)
    db.flush()

    raw_storage_key = upload_snapshot_raw(
        document_id=str(doc.id),
        snapshot_id=str(snapshot.id),
        content_type=content_type,
        raw_bytes=raw_bytes,
    )
    if raw_storage_key:
        snapshot.raw_storage_key = raw_storage_key
        db.add(snapshot)

    doc.last_snapshot_id = snapshot.id

    db.add(
        ProviderUsage(
            user_id=doc.user_id,
            document_id=doc.id,
            provider=Provider.playwright,
            action=ProviderAction.render_fetch,
            quantity=1,
            tokens_in=None,
            tokens_out=None,
            cost_usd_micros=None,
            period_key=period_key,
        )
    )

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
            summary_disclaimer="This summary is informational and not legal advice.",
            summary_model=None,
            summary_prompt_version=None,
            summary_error=None,
        )
        db.add(event)
        db.flush()

        doc.last_change_event_id = event.id

        db.add(
            Job(
                user_id=doc.user_id,
                document_id=doc.id,
                job_type=JobType.summarize,
                status=JobStatus.queued,
            )
        )

    db.add(doc)
    db.commit()


def _has_render_quota(*, db: Session, user_id: object, period_key: str) -> bool:
    entitlement = (
        db.execute(select(Entitlement).where(Entitlement.user_id == user_id))
        .scalars()
        .one_or_none()
    )
    limits = entitlement.limits if entitlement is not None else {}

    raw_limit = limits.get("js_render_fetches_per_month")
    limit = raw_limit if isinstance(raw_limit, int) else 0
    if limit <= 0:
        return False

    used = (
        db.execute(
            select(func.coalesce(func.sum(ProviderUsage.quantity), 0)).where(
                ProviderUsage.user_id == user_id,
                ProviderUsage.period_key == period_key,
                ProviderUsage.provider == Provider.playwright,
                ProviderUsage.action == ProviderAction.render_fetch,
            )
        )
        .scalars()
        .one()
    )
    return int(used) < limit


def _playwright_fetch(url: str) -> tuple[int, str, str | None, bytes]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as e:
        raise RuntimeError("playwright is not installed") from e

    _validate_fetch_url(url)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        context = browser.new_context(user_agent=_DEFAULT_USER_AGENT)
        page = context.new_page()

        def _handle_route(route, request) -> None:
            if request.resource_type in {"image", "font", "media"}:
                route.abort()
                return

            try:
                if request.url.startswith(("data:", "blob:", "about:")):
                    route.continue_()
                    return

                _validate_fetch_url(request.url)
            except Exception:
                route.abort()
                return

            route.continue_()

        page.route("**/*", _handle_route)

        response = page.goto(url, wait_until="networkidle", timeout=60_000)
        html = page.content()
        final_url = page.url

        status = response.status if response is not None else 200
        content_type = None
        if response is not None:
            content_type = response.headers.get("content-type")

        context.close()
        browser.close()

    return status, final_url, content_type, html.encode("utf-8")
