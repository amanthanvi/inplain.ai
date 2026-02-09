#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
import trafilatura

from inplain.worker.handlers.common import check_robots, strip_cosmetic

_MIN_EXTRACTED_CHARS = 500
_CONNECT_TIMEOUT_SECONDS = 8
_READ_TIMEOUT_SECONDS = 25
_USER_AGENT = "inplain.ai (+https://inplain.ai)"


@dataclass
class ValidationResult:
    slug: str
    doc_type: str
    url: str
    ok: bool
    http_status: int | None
    robots_allowed: bool
    extracted_chars: int
    reason: str | None = None


def _load_catalog(path: Path) -> list[dict[str, Any]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("catalog must be a JSON array")
    return [item for item in raw if isinstance(item, dict)]


def _extract_text_from_html(html_bytes: bytes) -> str:
    extracted = trafilatura.extract(
        html_bytes.decode("utf-8", errors="ignore"),
        include_comments=False,
        include_tables=False,
        include_links=False,
        favor_precision=True,
        deduplicate=True,
    )
    return strip_cosmetic(extracted or "")


def _validate_url(slug: str, doc_type: str, url: str) -> ValidationResult:
    robots = check_robots(url)
    if not robots.allowed:
        return ValidationResult(
            slug=slug,
            doc_type=doc_type,
            url=url,
            ok=False,
            http_status=None,
            robots_allowed=False,
            extracted_chars=0,
            reason=robots.rule or "blocked by robots.txt",
        )

    timeout = httpx.Timeout(_READ_TIMEOUT_SECONDS, connect=_CONNECT_TIMEOUT_SECONDS)
    headers = {"user-agent": _USER_AGENT}
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
    except Exception as exc:  # noqa: BLE001
        return ValidationResult(
            slug=slug,
            doc_type=doc_type,
            url=url,
            ok=False,
            http_status=None,
            robots_allowed=True,
            extracted_chars=0,
            reason=f"http error: {exc}",
        )

    if response.status_code != 200:
        return ValidationResult(
            slug=slug,
            doc_type=doc_type,
            url=url,
            ok=False,
            http_status=response.status_code,
            robots_allowed=True,
            extracted_chars=0,
            reason="non-200 status",
        )

    content_type = (response.headers.get("content-type") or "").lower()
    if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
        return ValidationResult(
            slug=slug,
            doc_type=doc_type,
            url=url,
            ok=False,
            http_status=response.status_code,
            robots_allowed=True,
            extracted_chars=0,
            reason=f"unsupported content-type: {content_type}",
        )

    text = _extract_text_from_html(response.content)
    chars = len(text)
    if chars < _MIN_EXTRACTED_CHARS:
        return ValidationResult(
            slug=slug,
            doc_type=doc_type,
            url=url,
            ok=False,
            http_status=response.status_code,
            robots_allowed=True,
            extracted_chars=chars,
            reason=f"extracted text too short ({chars})",
        )

    return ValidationResult(
        slug=slug,
        doc_type=doc_type,
        url=url,
        ok=True,
        http_status=response.status_code,
        robots_allowed=True,
        extracted_chars=chars,
        reason=None,
    )


def _format_markdown(results: list[ValidationResult], *, total_companies: int) -> str:
    total_urls = len(results)
    passed = sum(1 for r in results if r.ok)
    failed = total_urls - passed
    lines = [
        "# Catalog Validation Report",
        "",
        f"- Companies checked: {total_companies}",
        f"- Policy URLs checked: {total_urls}",
        f"- Passed: {passed}",
        f"- Failed: {failed}",
        "",
        "| Slug | Type | HTTP | Robots | Extracted chars | Result | URL | Notes |",
        "|------|------|------|--------|-----------------|--------|-----|-------|",
    ]
    for result in results:
        http_status = str(result.http_status) if result.http_status is not None else "-"
        robots = "allow" if result.robots_allowed else "block"
        status = "PASS" if result.ok else "FAIL"
        notes = result.reason or ""
        lines.append(
            f"| {result.slug} | {result.doc_type} | {http_status} | {robots} | "
            f"{result.extracted_chars} | {status} | {result.url} | {notes} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate catalog policy URLs for launch readiness.")
    parser.add_argument("--catalog", type=Path, default=Path("catalog.json"))
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("docs/catalog-validation.md"),
        help="Markdown report output path",
    )
    args = parser.parse_args()

    entries = _load_catalog(args.catalog)
    results: list[ValidationResult] = []
    for entry in entries:
        slug = str(entry.get("slug") or "")
        policy_urls = entry.get("policy_urls")
        if not slug or not isinstance(policy_urls, dict):
            continue

        for doc_type, url in policy_urls.items():
            if not isinstance(url, str) or not url:
                continue
            results.append(_validate_url(slug, str(doc_type), url))

    report_text = _format_markdown(results, total_companies=len(entries))
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report_text, encoding="utf-8")
    print(report_text)

    failures = [r for r in results if not r.ok]
    if failures:
        print(f"\nValidation failed: {len(failures)} URL(s) did not pass checks.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
