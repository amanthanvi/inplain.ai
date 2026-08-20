"""inplain.detect — git history of documents/ → change records in changes/.

Every test runs against a real temporary git repository (the ``repo``
fixture): git is the datastore under test. No network, ever.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pytest

from inplain import detect, schema
from inplain.crawl import Document, commit_message
from inplain.detect import (
    REASON_ADDED,
    REASON_BELOW_THRESHOLD,
    REASON_COSMETIC,
    REASON_EFFECTIVE_DATE,
    REASON_REMOVED,
    SENTENCE_CHARS,
    Detector,
    assess_materiality,
    diff_lines,
    is_cosmetic_line,
    is_effective_date_line,
    parse_effective_date,
)

from .conftest import git

PROTOTYPES = Path(__file__).resolve().parents[1] / "prototypes"

AUTHOR_DATE = "2026-08-19T12:00:00+00:00"

BASE_LINES = [
    "Privacy Policy",
    "Effective date: January 1, 2025",
    "We collect the information you give us when you use the service.",
    "We use that information to operate and improve the service.",
    "You can contact us with questions about this policy.",
    "© 2025 Example Corp.",
]

# The canonical SPEC §7 case: one sentence, 67 characters, that a
# whole-document similarity ratio scores as cosmetic inside a large policy.
SELL_SENTENCE = "We now sell your personal information, to our advertising partners."


def text_of(lines: list[str]) -> str:
    return "\n".join(lines) + "\n"


def commit_doc(
    root: Path,
    lines: list[str],
    *,
    company: str = "example",
    doc: str = "privacy",
    message: str | None = None,
    date: str = AUTHOR_DATE,
) -> str:
    """Write and commit one document the way T1 does: one path per commit,
    company/doc/url in the message, a controlled author date."""
    relpath = f"documents/{company}/{doc}.txt"
    path = root / relpath
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text_of(lines), encoding="utf-8", newline="\n")
    if message is None:
        document = Document(company, company.title(), doc, f"https://{company}.com/{doc}")
        message = commit_message(document)
    git(root, "add", "--", relpath)
    git(root, "commit", "--no-verify", f"--date={date}", "-m", message, "--", relpath)
    return git(root, "rev-parse", "HEAD").strip()


def records_in(root: Path) -> list[Path]:
    changes = root / "changes"
    return sorted(changes.glob("*.json")) if changes.exists() else []


# --------------------------------------------------------------------------
# line classification


def test_parse_effective_date_formats():
    assert parse_effective_date("Effective April 2, 2026 | Archived versions") == "2026-04-02"
    assert parse_effective_date("Effective date: January 1, 2025") == "2025-01-01"
    assert parse_effective_date("Last updated: 2025-06-01") == "2025-06-01"
    assert parse_effective_date("Updated 14 March 2026") == "2026-03-14"
    assert parse_effective_date("no date here") is None
    assert parse_effective_date("Effective February 31, 2026") is None  # not a date


def test_effective_date_line_needs_keyword_and_date():
    assert is_effective_date_line("Effective date: January 1, 2025")
    assert is_effective_date_line("Last modified June 1, 2025.")
    assert not is_effective_date_line("We met on January 1, 2025.")  # no keyword
    assert not is_effective_date_line("Effective controls protect data.")  # no date


def test_cosmetic_covers_copyright_and_page_numbers_only():
    assert is_cosmetic_line("© 2025 Example Corp.")
    assert is_cosmetic_line("Copyright (c) 2024 Acme Inc. All rights reserved.")
    assert is_cosmetic_line("Page 3 of 12")
    assert is_cosmetic_line("- 7 -")
    assert not is_cosmetic_line("We collect your data.")


def test_effective_date_lines_are_never_cosmetic():
    """A line matching a cosmetic pattern AND an effective-date pattern is
    signal, not noise — the suppression must never cover it."""
    line = "© 2026 Example — last updated January 5, 2026"
    assert is_effective_date_line(line)
    assert not is_cosmetic_line(line)


# --------------------------------------------------------------------------
# the diff and the gate


def test_diff_computed_once_feeds_hunks_counts_and_badge():
    old = ["a", "the old clause stays here", "z"]
    new = ["a", "the new clause goes here now", "z"]
    diff = diff_lines(old, new)
    assert len(diff.hunks) == 1
    assert diff.removed_lines == ["the old clause stays here"]
    assert diff.added_lines == ["the new clause goes here now"]
    assert 0.0 < diff.similarity_badge < 1.0
    materiality = assess_materiality(diff)
    # the same single diff's output is what the gate measured
    assert materiality.added_chars == len("the new clause goes here now")
    assert materiality.similarity_badge == diff.similarity_badge


def test_hunks_keep_added_and_removed_strictly_separate():
    old = ["ctx1", "we will never sell your data", "ctx2"]
    new = ["ctx1", "we may sell your data to partners", "ctx2"]
    (hunk,) = diff_lines(old, new).hunks
    assert hunk.removed == ["we will never sell your data"]
    assert hunk.added == ["we may sell your data to partners"]
    assert not set(hunk.removed) & set(hunk.added)
    assert hunk.context_before == ["ctx1"]
    assert hunk.context_after == ["ctx2"]


def test_context_is_capped_at_three_lines():
    old = [f"line {i}" for i in range(10)]
    new = old[:5] + ["INSERTED"] + old[5:]
    (hunk,) = diff_lines(old, new).hunks
    assert len(hunk.context_before) == 3
    assert len(hunk.context_after) == 3
    assert hunk.old_start == 6
    assert hunk.new_start == 6


def test_removed_prose_beyond_threshold_is_material():
    old = ["keep", "You may opt out of all data sharing at any time via your settings.", "keep2"]
    diff = diff_lines(old, ["keep", "keep2"])
    materiality = assess_materiality(diff)
    assert materiality.material is True
    assert materiality.reason == REASON_REMOVED
    assert materiality.removed_chars >= SENTENCE_CHARS


# --------------------------------------------------------------------------
# the detector against real repositories


def test_first_snapshot_produces_no_record(repo, caplog):
    caplog.set_level(logging.INFO, logger="inplain.detect")
    commit_doc(repo, BASE_LINES)
    report = Detector(repo).run()
    assert (report.created, report.suppressed, report.skipped) == (0, 0, 1)
    assert records_in(repo) == []
    assert "track-start" in caplog.text  # logged, not silent


def test_real_change_produces_a_valid_record(repo):
    parent = commit_doc(repo, BASE_LINES)
    changed = BASE_LINES[:4] + [SELL_SENTENCE] + BASE_LINES[4:]
    sha = commit_doc(repo, changed, date="2026-08-20T09:30:00+02:00")
    report = Detector(repo).run()
    assert report.created == 1 and report.suppressed == 0

    path = repo / "changes" / f"example-privacy-{sha[:7]}.json"
    assert path.exists(), [p.name for p in records_in(repo)]
    record = schema.load_record(path)  # validates against the schema
    assert record["id"] == f"example-privacy-{sha[:7]}"
    assert record["commit"] == sha
    assert record["parent_commit"] == parent
    assert record["company"] == "example"
    assert record["company_name"] == "Example"  # from the T1 commit message
    assert record["doc"] == "privacy"
    assert record["source_url"] == "https://example.com/privacy"
    # author date of the document commit, normalized to UTC — not wall clock
    assert record["detected_at"] == "2026-08-20T07:30:00Z"
    assert record["materiality"]["material"] is True
    assert record["materiality"]["reason"] == REASON_ADDED
    added = [line for hunk in record["hunks"] for line in hunk["added"]]
    assert SELL_SENTENCE in added


def test_effective_date_only_change_is_material(repo):
    """AC-5: an effective-date-only change produces a material change record,
    with the reason recording exactly that."""
    commit_doc(repo, BASE_LINES)
    changed = list(BASE_LINES)
    changed[1] = "Effective date: March 15, 2026"
    sha = commit_doc(repo, changed)
    report = Detector(repo).run()
    assert report.created == 1 and report.suppressed == 0
    record = schema.load_record(repo / "changes" / f"example-privacy-{sha[:7]}.json")
    materiality = record["materiality"]
    assert materiality["material"] is True
    assert materiality["reason"] == REASON_EFFECTIVE_DATE
    assert materiality["added_chars"] < SENTENCE_CHARS  # the gate alone said no
    assert materiality["effective_date_change"] == {
        "from": "2025-01-01",
        "to": "2026-03-15",
    }
    (hunk,) = record["hunks"]
    assert hunk["removed"] == ["Effective date: January 1, 2025"]
    assert hunk["added"] == ["Effective date: March 15, 2026"]



def test_one_sided_effective_date_change_records_the_present_side():
    from inplain.detect import assess_materiality, diff_lines

    old = ["Effective date: January 5, 2024", "We collect data."]
    new = ["We collect data."]
    m = assess_materiality(diff_lines(old, new))
    assert m.material
    assert m.effective_date_change == {"from": "2024-01-05", "to": None}

    m = assess_materiality(diff_lines(new, old))
    assert m.effective_date_change == {"from": None, "to": "2024-01-05"}

def test_subthreshold_cosmetic_edit_is_suppressed_with_reason(repo):
    """Suppressed means unpublished, not unrecorded: the record is written,
    carries material:false, and names a machine-readable reason."""
    commit_doc(repo, BASE_LINES)
    changed = list(BASE_LINES)
    changed[-1] = "© 2026 Example Corp."
    sha = commit_doc(repo, changed)
    report = Detector(repo).run()
    assert report.created == 0 and report.suppressed == 1
    record = schema.load_record(repo / "changes" / f"example-privacy-{sha[:7]}.json")
    materiality = record["materiality"]
    assert materiality["material"] is False
    assert materiality["reason"] == REASON_COSMETIC
    assert materiality["added_chars"] == 0  # cosmetic lines are not prose
    assert record["hunks"], "suppressed records still carry the evidence"


def test_subthreshold_prose_edit_is_suppressed_with_reason(repo):
    commit_doc(repo, BASE_LINES)
    changed = list(BASE_LINES)
    changed[4] = "You can contact us with any questions about this policy."
    sha = commit_doc(repo, changed)
    report = Detector(repo).run()
    assert report.suppressed == 1
    record = schema.load_record(repo / "changes" / f"example-privacy-{sha[:7]}.json")
    assert record["materiality"]["material"] is False
    assert record["materiality"]["reason"] == REASON_BELOW_THRESHOLD


def test_sentence_insert_into_large_document_is_material(repo):
    """SPEC §7's canonical failure: a 67-character insert into a ~65k policy
    scores ~0.997 whole-document similarity. The absolute gate publishes it;
    the ratio survives only as the display badge."""
    assert len(SELL_SENTENCE) == 67
    big = [
        f"Section {i}: we process the data described above for purpose {i}."
        for i in range(1000)
    ]
    assert len(text_of(big)) > 60_000
    commit_doc(repo, big)
    sha = commit_doc(repo, big[:500] + [SELL_SENTENCE] + big[500:])
    report = Detector(repo).run()
    assert report.created == 1
    record = schema.load_record(repo / "changes" / f"example-privacy-{sha[:7]}.json")
    materiality = record["materiality"]
    assert materiality["material"] is True
    assert materiality["reason"] == REASON_ADDED
    assert materiality["added_chars"] == 67
    assert materiality["similarity_badge"] > 0.99  # the ratio a gate would trust
    (hunk,) = record["hunks"]
    assert hunk["added"] == [SELL_SENTENCE]
    assert hunk["removed"] == []


def test_rerun_is_idempotent(repo):
    commit_doc(repo, BASE_LINES)
    sha = commit_doc(repo, BASE_LINES[:4] + [SELL_SENTENCE] + BASE_LINES[4:])
    first = Detector(repo).run()
    assert first.created == 1
    path = repo / "changes" / f"example-privacy-{sha[:7]}.json"
    before = path.read_bytes()
    second = Detector(repo).run()
    assert (second.created, second.suppressed) == (0, 0)
    assert second.skipped >= 2  # the first snapshot and the recorded change
    assert path.read_bytes() == before
    assert len(records_in(repo)) == 1


def test_identity_falls_back_to_catalog_for_manual_commits(repo):
    commit_doc(repo, BASE_LINES)
    sha = commit_doc(
        repo,
        BASE_LINES[:4] + [SELL_SENTENCE] + BASE_LINES[4:],
        message="manual edit, no structured trailer",
    )
    Detector(repo).run()
    record = schema.load_record(repo / "changes" / f"example-privacy-{sha[:7]}.json")
    # conftest's seeded catalog.json supplies the identity instead
    assert record["company_name"] == "Example"
    assert record["source_url"] == "https://example.com/privacy"


def test_limit_caps_records_per_run_oldest_first(repo):
    commit_doc(repo, BASE_LINES)
    first_change = commit_doc(repo, BASE_LINES[:4] + [SELL_SENTENCE] + BASE_LINES[4:])
    commit_doc(
        repo,
        BASE_LINES[:2] + [SELL_SENTENCE] + BASE_LINES[2:],
        company="other",
        doc="tos",
    )
    commit_doc(
        repo,
        BASE_LINES[:2] + [SELL_SENTENCE, "And we log it."] + BASE_LINES[2:],
        company="other",
        doc="tos",
    )
    limited = Detector(repo).run(limit=1)
    assert limited.created + limited.suppressed == 1
    assert [p.stem for p in records_in(repo)] == [f"example-privacy-{first_change[:7]}"]
    # a later run resumes where the limit stopped (other/tos v1 is its own
    # track-start; its second commit adds one short line, hence suppressed)
    rest = Detector(repo).run()
    assert (rest.created, rest.suppressed) == (0, 1)
    assert len(records_in(repo)) == 2


def test_multiple_documents_get_distinct_records(repo):
    commit_doc(repo, BASE_LINES)
    commit_doc(repo, BASE_LINES, company="other", doc="tos")
    sha_a = commit_doc(repo, BASE_LINES[:4] + [SELL_SENTENCE] + BASE_LINES[4:])
    sha_b = commit_doc(
        repo,
        BASE_LINES[:2] + [SELL_SENTENCE] + BASE_LINES[2:],
        company="other",
        doc="tos",
    )
    report = Detector(repo).run()
    assert report.created == 2
    stems = {p.stem for p in records_in(repo)}
    assert stems == {f"example-privacy-{sha_a[:7]}", f"other-tos-{sha_b[:7]}"}


def test_non_document_paths_are_ignored(repo):
    commit_doc(repo, BASE_LINES)
    state = repo / "documents" / ".crawlstate.json"
    state.write_text("{}\n", encoding="utf-8", newline="\n")
    git(repo, "add", "--", "documents/.crawlstate.json")
    git(repo, "commit", "--no-verify", "-m", "crawl: update conditional-GET state")
    report = Detector(repo).run()
    assert report.created == 0 and report.suppressed == 0
    assert records_in(repo) == []


# --------------------------------------------------------------------------
# the prototype pair: a real Google privacy diff, end to end


def test_prototype_sample_pair_roundtrips_through_git(repo):
    previous = (PROTOTYPES / "sample-previous.txt").read_text(encoding="utf-8")
    current = (PROTOTYPES / "sample-current.txt").read_text(encoding="utf-8")
    sample = json.loads((PROTOTYPES / "sample-hunks.json").read_text(encoding="utf-8"))
    commit_doc(repo, previous.splitlines(), company="google", doc="privacy")
    sha = commit_doc(repo, current.splitlines(), company="google", doc="privacy")

    report = Detector(repo).run()
    assert report.created == 1
    record = schema.load_record(repo / "changes" / f"google-privacy-{sha[:7]}.json")
    assert record["materiality"]["material"] is True

    # Materially consistent with the prototype's 18 line-level hunks: every
    # changed line the prototype records appears on the same side here, and we
    # invent no changed content it does not have. Framing (context, grouping)
    # is allowed to differ; content and side are not.
    ours_removed = {line for hunk in record["hunks"] for line in hunk["removed"]}
    ours_added = {line for hunk in record["hunks"] for line in hunk["added"]}
    sample_removed = {line for hunk in sample for line in hunk["removed"]}
    sample_added = {line for hunk in sample for line in hunk["added"]}
    assert sample_removed <= ours_removed
    assert sample_added <= ours_added
    assert not (ours_removed - sample_removed)
    assert not (ours_added - sample_added)
    # ... and the sides never bleed into each other
    assert not ours_removed & sample_added - sample_removed
    # the prototype's effective-date line was removed without a replacement:
    # the removed side is recorded, the absent side is null
    assert record["materiality"]["effective_date_change"] == {
        "from": "2026-04-02",
        "to": None,
    }


# --------------------------------------------------------------------------
# CLI


def test_cli_prints_counts_and_exits_zero(repo, capsys):
    commit_doc(repo, BASE_LINES)
    commit_doc(repo, BASE_LINES[:4] + [SELL_SENTENCE] + BASE_LINES[4:])
    assert detect.main(["--root", str(repo)]) == 0
    out = capsys.readouterr().out
    assert "created=1" in out
    assert "skipped=1" in out
    assert "suppressed=0" in out


def test_cli_aborts_with_exit_2_outside_a_repository(tmp_path, capsys):
    (tmp_path / "empty").mkdir()
    assert detect.main(["--root", str(tmp_path / "empty")]) == 2
    assert "detect aborted" in capsys.readouterr().err


def test_cli_aborts_when_documents_dir_is_outside_root(repo, tmp_path, capsys):
    elsewhere = tmp_path / "elsewhere"
    elsewhere.mkdir()
    assert detect.main(["--root", str(repo), "--documents", str(elsewhere)]) == 2
    assert "detect aborted" in capsys.readouterr().err
