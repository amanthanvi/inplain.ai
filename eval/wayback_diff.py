"""Derive golden-set entries from real Wayback Machine captures.

Data-gathering helper for R2 (issue #30). This script IS allowed to touch the
network — it builds golden inputs, it is not part of the test suite, and tests
never import its network paths.

Usage:
    python eval/wayback_diff.py --url https://example.com/privacy \
        --company example --doc privacy \
        [--from-year 2024 --to-year 2026] [--out eval/golden/example.json]

It queries the Wayback CDX API for two captures of the URL (the earliest
capture at/after --from-year and the latest at/before end of --to-year, with
different content digests), fetches both raw captures, extracts readable text
with trafilatura, and converts the line diff into hunk objects matching the
normative change-record schema in docs/decisions/G1-word-level-highlighting.md.

The emitted JSON is a golden-entry *skeleton*: `expected.bullets` is empty and
must be written by hand against the real hunks.
"""

from __future__ import annotations

import argparse
import difflib
import json
import sys
from typing import Any

CDX_API = "https://web.archive.org/cdx/search/cdx"
CONTEXT_LINES = 3


def text_to_lines(text: str) -> list[str]:
    """Split extracted text into non-empty, stripped lines (paragraph units)."""
    return [line.strip() for line in text.splitlines() if line.strip()]


def hunks_from_lines(old_lines: list[str], new_lines: list[str]) -> list[dict[str, Any]]:
    """Build schema-shaped hunks from two line lists.

    Hunk shape is the normative one from
    docs/decisions/G1-word-level-highlighting.md: id, old_start, new_start
    (1-based), context_before/context_after (up to 3 lines), removed, added
    (strictly separate), word_spans (always null in v1).
    """
    matcher = difflib.SequenceMatcher(a=old_lines, b=new_lines, autojunk=False)
    hunks: list[dict[str, Any]] = []
    changes = [op for op in matcher.get_opcodes() if op[0] != "equal"]
    # Context stops at the neighbouring change, as in inplain.detect.diff_lines.
    next_starts = [op[1] for op in changes[1:]] + [len(old_lines)]
    prev_end = 0
    for (tag, i1, i2, j1, j2), next_start in zip(changes, next_starts):
        hunks.append(
            {
                "id": f"h{len(hunks) + 1}",
                "old_start": i1 + 1,
                "new_start": j1 + 1,
                "context_before": old_lines[max(prev_end, i1 - CONTEXT_LINES):i1],
                "removed": old_lines[i1:i2],
                "added": new_lines[j1:j2],
                "context_after": old_lines[i2:min(next_start, i2 + CONTEXT_LINES)],
                "word_spans": None,
            }
        )
        prev_end = i2
    return hunks


def hunks_from_texts(old_text: str, new_text: str) -> list[dict[str, Any]]:
    return hunks_from_lines(text_to_lines(old_text), text_to_lines(new_text))


# --------------------------------------------------------------------------
# Network side (data gathering only — never used by tests)
# --------------------------------------------------------------------------

def _session():  # deferred imports keep the pure diff logic importable offline
    import requests

    s = requests.Session()
    s.headers["User-Agent"] = "inplain.ai golden-set builder (github.com/amanthanvi/inplain.ai)"
    return s


def pick_captures(
    session: Any, url: str, from_year: int, to_year: int
) -> tuple[str, str]:
    """Return (old_timestamp, new_timestamp) with distinct content digests."""
    params = {
        "url": url,
        "output": "json",
        "fl": "timestamp,digest,statuscode",
        "filter": "statuscode:200",
        "collapse": "digest",
        "from": str(from_year),
        "to": f"{to_year}1231",
    }
    resp = session.get(CDX_API, params=params, timeout=60)
    resp.raise_for_status()
    rows = resp.json()
    if len(rows) < 3:  # header row + at least two distinct captures
        raise SystemExit(
            f"CDX returned {max(0, len(rows) - 1)} distinct capture(s) for {url}; need 2."
        )
    captures = rows[1:]
    old_ts, old_digest = captures[0][0], captures[0][1]
    for ts, digest, _status in reversed(captures):
        if digest != old_digest:
            return old_ts, ts
    raise SystemExit(f"All captures of {url} share one digest; no content change.")


def fetch_extracted(session: Any, timestamp: str, url: str) -> str:
    import trafilatura

    raw_url = f"https://web.archive.org/web/{timestamp}id_/{url}"
    resp = session.get(raw_url, timeout=120)
    resp.raise_for_status()
    text = trafilatura.extract(resp.text, url=url)
    if not text or len(text) < 500:
        raise SystemExit(
            f"trafilatura extracted {len(text or '')} chars from {raw_url}; too little."
        )
    return text


def build_entry(args: argparse.Namespace) -> dict[str, Any]:
    import requests

    session = _session()
    try:
        old_ts, new_ts = pick_captures(session, args.url, args.from_year, args.to_year)
        print(f"captures: {old_ts} -> {new_ts}", file=sys.stderr)
        old_text = fetch_extracted(session, old_ts, args.url)
        new_text = fetch_extracted(session, new_ts, args.url)
    except requests.exceptions.Timeout as exc:
        raise SystemExit(f"Wayback request timed out: {exc}") from exc
    except requests.exceptions.ConnectionError as exc:
        raise SystemExit(f"Could not reach the Wayback Machine: {exc}") from exc
    except requests.exceptions.HTTPError as exc:
        raise SystemExit(f"Wayback returned an HTTP error: {exc}") from exc

    hunks = hunks_from_texts(old_text, new_text)
    if not hunks:
        raise SystemExit("Captures differ by digest but extracted text is identical.")
    return {
        "id": f"{args.company}-{args.doc}-wayback-{old_ts[:8]}-{new_ts[:8]}",
        "source": "wayback",
        "company": args.company,
        "doc": args.doc,
        "hunks": hunks,
        "expected": {"bullets": []},
        "notes": (
            f"Real diff between Wayback captures {old_ts} and {new_ts} of "
            f"{args.url}, extracted with trafilatura. Expected bullets are "
            "hand-written against these hunks."
        ),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True)
    parser.add_argument("--company", required=True)
    parser.add_argument("--doc", required=True)
    parser.add_argument("--from-year", type=int, default=2023)
    parser.add_argument("--to-year", type=int, default=2026)
    parser.add_argument("--out", default=None, help="output path (default: stdout)")
    args = parser.parse_args()

    entry = build_entry(args)
    payload = json.dumps(entry, indent=2, ensure_ascii=False) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(payload)
        print(f"wrote {args.out} ({len(entry['hunks'])} hunks)", file=sys.stderr)
    else:
        sys.stdout.write(payload)


if __name__ == "__main__":
    main()
