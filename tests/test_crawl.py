"""The crawl itself: conduct on the way out, one commit per change on the way in."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

import inplain.crawl as crawl_module
from inplain.crawl import (
    STATE_FILENAME,
    Crawler,
    Git,
    GitError,
    Politeness,
    Status,
    build_parser,
    load_catalog,
)
from inplain.net import USER_AGENT, SizeCapExceeded

from .conftest import (
    PARAGRAPH,
    FakeTransport,
    SleepRecorder,
    commit_count,
    conditional_html,
    files_in_commit,
    git,
    html_response,
    not_modified,
    policy_html,
    redirect_response,
    resolver_for,
    response,
    robots_response,
)

PRIVACY = "https://example.com/privacy"
TERMS = "https://other.test/terms"

ALLOW_ALL = "User-agent: *\nAllow: /\n"


def base_routes(**extra):
    routes = {
        "https://example.com/robots.txt": robots_response("https://example.com/robots.txt"),
        PRIVACY: html_response(PRIVACY),
        "https://other.test/robots.txt": robots_response("https://other.test/robots.txt"),
        TERMS: html_response(TERMS, policy_html(title="Terms of Service")),
    }
    routes.update(extra)
    return routes


def make_crawler(
    repo: Path,
    transport: FakeTransport,
    *,
    resolver=None,
    commit: bool = True,
    politeness: Politeness | None = None,
    **kwargs,
) -> Crawler:
    return Crawler(
        repo,
        transport=transport,
        resolver=resolver or resolver_for(),
        politeness=politeness or Politeness(delay=0.0, sleep=SleepRecorder()),
        commit=commit,
        **kwargs,
    )


def write_catalog(repo: Path, entries) -> None:
    (repo / "catalog.json").write_text(
        json.dumps(entries, indent=2) + "\n", encoding="utf-8", newline="\n"
    )


def state_of(repo: Path) -> dict:
    return json.loads((repo / "documents" / STATE_FILENAME).read_text("utf-8"))


# -- writing and committing -------------------------------------------------


def test_a_change_is_a_commit(repo):
    transport = FakeTransport(base_routes())
    before = commit_count(repo)
    report = make_crawler(repo, transport).run(only=["example"])

    outcome = report.outcomes[0]
    assert outcome.status is Status.CHANGED
    assert outcome.commit
    path = repo / "documents" / "example" / "privacy.txt"
    assert path.read_text("utf-8").startswith("Privacy Policy\n")
    # the document commit, then the state commit
    assert commit_count(repo) == before + 2
    assert files_in_commit(repo, outcome.commit) == ["documents/example/privacy.txt"]


def test_commit_message_identifies_company_doc_and_url(repo):
    transport = FakeTransport(base_routes())
    report = make_crawler(repo, transport).run(only=["example"])
    message = git(repo, "log", "-1", "--format=%B", report.outcomes[0].commit)
    assert "crawl: example/privacy" in message
    assert "company: Example (example)" in message
    assert "doc: privacy" in message
    assert f"url: {PRIVACY}" in message


def test_each_changed_document_is_its_own_commit(repo):
    transport = FakeTransport(base_routes())
    before = commit_count(repo)
    report = make_crawler(repo, transport).run()

    commits = [o.commit for o in report.outcomes]
    assert len(set(commits)) == 2
    assert commit_count(repo) == before + 3  # two documents plus the state
    for outcome in report.outcomes:
        assert files_in_commit(repo, outcome.commit) == [
            f"documents/{outcome.document.company}/{outcome.document.doc}.txt"
        ]


def test_unchanged_content_writes_nothing_and_commits_nothing(repo):
    """AC-1: a crawl commits only genuinely changed documents."""
    transport = FakeTransport(base_routes())
    make_crawler(repo, transport).run(only=["example"])

    path = repo / "documents" / "example" / "privacy.txt"
    mtime = path.stat().st_mtime_ns
    after_first = commit_count(repo)

    report = make_crawler(repo, FakeTransport(base_routes())).run(only=["example"])

    assert report.outcomes[0].status is Status.UNCHANGED
    assert report.outcomes[0].commit is None
    assert path.stat().st_mtime_ns == mtime  # not even rewritten
    assert commit_count(repo) == after_first  # state is identical too


def test_changed_content_is_written_and_committed(repo):
    transport = FakeTransport(base_routes())
    make_crawler(repo, transport).run(only=["example"])
    before = commit_count(repo)

    revised = policy_html("We now sell your personal information. " + PARAGRAPH * 3)
    transport = FakeTransport(base_routes(**{PRIVACY: html_response(PRIVACY, revised)}))
    report = make_crawler(repo, transport).run(only=["example"])

    outcome = report.outcomes[0]
    assert outcome.status is Status.CHANGED
    text = (repo / "documents" / "example" / "privacy.txt").read_text("utf-8")
    assert "We now sell your personal information." in text
    assert commit_count(repo) == before + 2
    assert files_in_commit(repo, outcome.commit) == ["documents/example/privacy.txt"]


def test_no_commit_writes_the_file_but_leaves_git_alone(repo):
    transport = FakeTransport(base_routes())
    before = commit_count(repo)
    report = make_crawler(repo, transport, commit=False).run(only=["example"])

    assert report.outcomes[0].status is Status.CHANGED
    assert report.outcomes[0].commit is None
    assert (repo / "documents" / "example" / "privacy.txt").exists()
    assert commit_count(repo) == before


def test_an_uncommitted_snapshot_from_an_interrupted_run_is_recovered(repo):
    transport = FakeTransport(base_routes())
    make_crawler(repo, transport, commit=False).run(only=["example"])
    before = commit_count(repo)

    report = make_crawler(repo, FakeTransport(base_routes())).run(only=["example"])

    assert report.outcomes[0].status is Status.CHANGED
    assert commit_count(repo) == before + 2
    assert files_in_commit(repo, report.outcomes[0].commit) == [
        "documents/example/privacy.txt"
    ]


def test_state_is_committed_on_its_own(repo):
    transport = FakeTransport(base_routes())
    report = make_crawler(repo, transport).run(only=["example"])
    assert files_in_commit(repo, report.state_commit) == ["documents/.crawlstate.json"]


def test_an_unchanged_crawl_commits_no_state(repo):
    """The state holds validators only: no per-run timestamp turns an
    unchanged crawl into a state commit."""
    routes = base_routes(**{PRIVACY: html_response(PRIVACY, ETag='"v1"')})
    make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    assert set(state_of(repo)["urls"][PRIVACY]) == {"etag", "content_sha256"}
    before = commit_count(repo)

    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])

    assert report.outcomes[0].status is Status.UNCHANGED
    assert report.state_commit is None
    assert commit_count(repo) == before


# -- conditional GET --------------------------------------------------------


def test_validators_are_sent_on_the_next_crawl(repo):
    routes = base_routes(
        **{PRIVACY: html_response(PRIVACY, ETag='"v1"', **{"Last-Modified": "Wed, 01 Jul 2026 10:00:00 GMT"})}
    )
    make_crawler(repo, FakeTransport(routes)).run(only=["example"])

    transport = FakeTransport(routes)
    make_crawler(repo, transport).run(only=["example"])

    sent = transport.requests_for(PRIVACY)[0].headers
    assert sent["If-None-Match"] == '"v1"'
    assert sent["If-Modified-Since"] == "Wed, 01 Jul 2026 10:00:00 GMT"


def test_304_keeps_the_stored_validators_and_skips_extraction(repo):
    routes = base_routes(
        **{PRIVACY: html_response(PRIVACY, ETag='"v1"', **{"Last-Modified": "Wed, 01 Jul 2026 10:00:00 GMT"})}
    )
    make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    path = repo / "documents" / "example" / "privacy.txt"
    mtime = path.stat().st_mtime_ns
    after_first = commit_count(repo)

    # A 304 that omits the validators entirely — the case v0.2.0 wrote None over.
    bare_304 = base_routes(**{PRIVACY: not_modified(PRIVACY)})
    report = make_crawler(repo, FakeTransport(bare_304)).run(only=["example"])

    assert report.outcomes[0].status is Status.NOT_MODIFIED
    assert path.stat().st_mtime_ns == mtime
    entry = state_of(repo)["urls"][PRIVACY]
    assert entry["etag"] == '"v1"'
    assert entry["last_modified"] == "Wed, 01 Jul 2026 10:00:00 GMT"
    assert entry["content_sha256"]
    assert commit_count(repo) == after_first  # nothing changed to commit


def test_304_adopts_validators_when_it_supplies_them(repo):
    routes = base_routes(**{PRIVACY: html_response(PRIVACY, ETag='"v1"')})
    make_crawler(repo, FakeTransport(routes)).run(only=["example"])

    fresh = base_routes(**{PRIVACY: not_modified(PRIVACY, ETag='"v2"')})
    make_crawler(repo, FakeTransport(fresh)).run(only=["example"])

    assert state_of(repo)["urls"][PRIVACY]["etag"] == '"v2"'


def test_an_unsolicited_304_is_a_failure(repo):
    """Nothing was stored, so a 304 answers a question we never asked."""
    routes = base_routes(**{PRIVACY: not_modified(PRIVACY)})
    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])

    assert report.outcomes[0].status is Status.FAILED
    assert "unconditional" in report.outcomes[0].detail
    assert not (repo / "documents" / "example" / "privacy.txt").exists()


def test_a_200_without_validators_clears_stale_ones(repo):
    routes = base_routes(**{PRIVACY: html_response(PRIVACY, ETag='"v1"')})
    make_crawler(repo, FakeTransport(routes)).run(only=["example"])

    plain = base_routes(**{PRIVACY: html_response(PRIVACY, policy_html("Changed. " + PARAGRAPH * 4))})
    make_crawler(repo, FakeTransport(plain)).run(only=["example"])

    assert "etag" not in state_of(repo)["urls"][PRIVACY]


# -- state never outruns the archive ----------------------------------------
#
# A stored validator is a claim that the archive holds the body the origin is
# about to answer 304 for. Every test here is one way that claim can go false;
# each of them, left alone, silently loses a change until the origin edits the
# page again — which SPEC §8 puts months away.


class UncommittableGit(Git):
    """git that reads fine and refuses to commit: an index.lock, a full disk."""

    def commit_path(self, relpath: str, message: str) -> str:
        raise GitError("cannot lock ref 'HEAD'")


def seed_state(repo: Path, url: str, **entry: str) -> None:
    path = repo / "documents" / STATE_FILENAME
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": 1, "urls": {url: entry}}
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8", newline="\n")


def test_a_no_commit_run_persists_no_state(repo):
    routes = base_routes(**{PRIVACY: conditional_html(PRIVACY)})
    make_crawler(repo, FakeTransport(routes), commit=False).run(only=["example"])

    assert not (repo / "documents" / STATE_FILENAME).exists()


def test_a_no_commit_run_cannot_suppress_the_next_commit(repo):
    """The documented --no-commit flow must not cost the archive a change."""
    routes = base_routes(**{PRIVACY: conditional_html(PRIVACY)})
    make_crawler(repo, FakeTransport(routes), commit=False).run(only=["example"])
    before = commit_count(repo)

    transport = FakeTransport(base_routes(**{PRIVACY: conditional_html(PRIVACY)}))
    report = make_crawler(repo, transport).run(only=["example"])

    assert "If-None-Match" not in transport.requests_for(PRIVACY)[0].headers
    assert report.outcomes[0].status is Status.CHANGED
    assert commit_count(repo) == before + 2
    assert files_in_commit(repo, report.outcomes[0].commit) == [
        "documents/example/privacy.txt"
    ]


def test_a_failed_document_commit_records_no_validators(repo):
    routes = base_routes(**{PRIVACY: conditional_html(PRIVACY)})
    report = make_crawler(
        repo, FakeTransport(routes), git=UncommittableGit(repo)
    ).run(only=["example"])

    assert report.outcomes[0].status is Status.FAILED
    assert "commit failed" in report.outcomes[0].detail
    assert not (repo / "documents" / STATE_FILENAME).exists()

    # The next run must still see the change the failed one could not commit.
    transport = FakeTransport(base_routes(**{PRIVACY: conditional_html(PRIVACY)}))
    report = make_crawler(repo, transport).run(only=["example"])

    assert "If-None-Match" not in transport.requests_for(PRIVACY)[0].headers
    assert report.outcomes[0].status is Status.CHANGED
    assert files_in_commit(repo, report.outcomes[0].commit) == [
        "documents/example/privacy.txt"
    ]


def test_a_304_for_a_snapshot_missing_from_the_archive_refetches(repo):
    seed_state(repo, PRIVACY, etag='"v1"')
    transport = FakeTransport(base_routes(**{PRIVACY: conditional_html(PRIVACY)}))

    report = make_crawler(repo, transport).run(only=["example"])

    sent = [r.headers for r in transport.requests_for(PRIVACY)]
    assert len(sent) == 2  # the conditional one, then the recovery
    assert sent[0]["If-None-Match"] == '"v1"'
    assert "If-None-Match" not in sent[1]
    assert report.outcomes[0].status is Status.CHANGED
    assert files_in_commit(repo, report.outcomes[0].commit) == [
        "documents/example/privacy.txt"
    ]


def test_a_304_for_an_uncommitted_snapshot_refetches(repo):
    path = repo / "documents" / "example" / "privacy.txt"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("Privacy Policy\n\nnever committed\n", encoding="utf-8", newline="\n")
    seed_state(repo, PRIVACY, etag='"v1"')
    transport = FakeTransport(base_routes(**{PRIVACY: conditional_html(PRIVACY)}))

    report = make_crawler(repo, transport).run(only=["example"])

    assert len(transport.requests_for(PRIVACY)) == 2
    assert report.outcomes[0].status is Status.CHANGED
    assert path.read_text("utf-8").startswith("Privacy Policy\n")
    assert "never committed" not in path.read_text("utf-8")
    assert files_in_commit(repo, report.outcomes[0].commit) == [
        "documents/example/privacy.txt"
    ]


def test_a_304_for_a_snapshot_that_was_reverted_refetches(repo):
    """Someone reverted the snapshot commit; the validators no longer match it."""
    routes = base_routes(**{PRIVACY: conditional_html(PRIVACY)})
    make_crawler(repo, FakeTransport(routes)).run(only=["example"])

    path = repo / "documents" / "example" / "privacy.txt"
    path.write_text("Privacy Policy\n\nreverted by hand\n", encoding="utf-8", newline="\n")
    git(repo, "commit", "--no-verify", "-m", "revert the snapshot", "--", str(path))

    transport = FakeTransport(base_routes(**{PRIVACY: conditional_html(PRIVACY)}))
    report = make_crawler(repo, transport).run(only=["example"])

    assert len(transport.requests_for(PRIVACY)) == 2
    assert report.outcomes[0].status is Status.CHANGED
    assert "reverted by hand" not in path.read_text("utf-8")


def test_a_304_for_a_committed_snapshot_is_trusted(repo):
    """The recovery path must not turn every 304 into a full GET."""
    routes = base_routes(**{PRIVACY: conditional_html(PRIVACY)})
    make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    after_first = commit_count(repo)

    transport = FakeTransport(base_routes(**{PRIVACY: conditional_html(PRIVACY)}))
    report = make_crawler(repo, transport).run(only=["example"])

    assert report.outcomes[0].status is Status.NOT_MODIFIED
    assert len(transport.requests_for(PRIVACY)) == 1  # no refetch
    assert commit_count(repo) == after_first


# -- robots -----------------------------------------------------------------


def test_a_disallowed_document_is_never_fetched(repo):
    routes = base_routes(
        **{
            "https://example.com/robots.txt": robots_response(
                "https://example.com/robots.txt",
                "User-agent: inplainbot\nDisallow: /privacy\n",
            )
        }
    )
    transport = FakeTransport(routes)
    report = make_crawler(repo, transport).run(only=["example"])

    assert report.outcomes[0].status is Status.BLOCKED
    assert transport.urls == ["https://example.com/robots.txt"]
    assert not (repo / "documents" / "example" / "privacy.txt").exists()


def test_robots_unreachable_blocks_the_document(repo):
    routes = base_routes()
    del routes["https://example.com/robots.txt"]  # transport refuses the route
    transport = FakeTransport(routes)
    report = make_crawler(repo, transport).run(only=["example"])

    assert report.outcomes[0].status is Status.BLOCKED
    assert PRIVACY not in transport.urls


def test_robots_5xx_blocks_the_document(repo):
    routes = base_routes(
        **{"https://example.com/robots.txt": response("https://example.com/robots.txt", 503)}
    )
    transport = FakeTransport(routes)
    report = make_crawler(repo, transport).run(only=["example"])

    assert report.outcomes[0].status is Status.BLOCKED
    assert PRIVACY not in transport.urls


def test_the_identity_we_send_is_the_identity_robots_judges(repo):
    transport = FakeTransport(base_routes())
    make_crawler(repo, transport).run(only=["example"])
    assert transport.requests, "nothing was requested"
    for recorded in transport.requests:
        assert recorded.headers["User-Agent"] == USER_AGENT


# -- redirects --------------------------------------------------------------


MIRROR = "https://mirror.test/privacy"


def test_redirect_to_a_robots_disallowed_url_is_blocked(repo):
    """AC-6: a robots-disallowed URL is never fetched, including after a redirect."""
    routes = base_routes(
        **{
            PRIVACY: redirect_response(PRIVACY, MIRROR, 301),
            "https://mirror.test/robots.txt": robots_response(
                "https://mirror.test/robots.txt",
                "User-agent: *\nDisallow: /privacy\n",
            ),
            MIRROR: html_response(MIRROR),
        }
    )
    transport = FakeTransport(routes)
    report = make_crawler(repo, transport).run(only=["example"])

    assert report.outcomes[0].status is Status.BLOCKED
    assert "https://mirror.test/robots.txt" in transport.urls  # we asked
    assert MIRROR not in transport.urls  # and we did not fetch
    assert not (repo / "documents" / "example" / "privacy.txt").exists()


def test_an_allowed_redirect_is_followed_and_stored_under_the_catalog_url(repo):
    routes = base_routes(
        **{
            PRIVACY: redirect_response(PRIVACY, MIRROR, 308),
            "https://mirror.test/robots.txt": robots_response("https://mirror.test/robots.txt"),
            MIRROR: html_response(MIRROR, policy_html("Mirrored policy. " + PARAGRAPH * 3)),
        }
    )
    transport = FakeTransport(routes)
    report = make_crawler(repo, transport).run(only=["example"])

    assert report.outcomes[0].status is Status.CHANGED
    text = (repo / "documents" / "example" / "privacy.txt").read_text("utf-8")
    assert "Mirrored policy." in text
    assert PRIVACY in state_of(repo)["urls"]
    assert MIRROR not in state_of(repo)["urls"]


def test_a_relative_redirect_is_resolved_against_the_hop(repo):
    routes = base_routes(
        **{
            PRIVACY: redirect_response(PRIVACY, "/legal/privacy", 302),
            "https://example.com/legal/privacy": html_response(
                "https://example.com/legal/privacy"
            ),
        }
    )
    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    assert report.outcomes[0].status is Status.CHANGED


def test_a_redirect_to_a_non_global_address_is_blocked(repo):
    internal = "https://internal.test/privacy"
    routes = base_routes(
        **{
            PRIVACY: redirect_response(PRIVACY, internal, 302),
            internal: html_response(internal),
            "https://internal.test/robots.txt": robots_response(
                "https://internal.test/robots.txt"
            ),
        }
    )
    transport = FakeTransport(routes)
    crawler = make_crawler(
        repo, transport, resolver=resolver_for({"internal.test": ["10.0.0.5"]})
    )
    report = crawler.run(only=["example"])

    assert report.outcomes[0].status is Status.BLOCKED
    assert "10.0.0.5" in report.outcomes[0].detail
    assert not any("internal.test" in url for url in transport.urls)


def test_a_redirect_to_cgnat_is_blocked(repo):
    internal = "https://cgnat.test/privacy"
    routes = base_routes(**{PRIVACY: redirect_response(PRIVACY, internal, 302)})
    transport = FakeTransport(routes)
    crawler = make_crawler(
        repo, transport, resolver=resolver_for({"cgnat.test": ["100.64.3.4"]})
    )
    report = crawler.run(only=["example"])

    assert report.outcomes[0].status is Status.BLOCKED
    assert not any("cgnat.test" in url for url in transport.urls)


def test_an_endless_redirect_chain_fails(repo):
    routes = base_routes(**{PRIVACY: redirect_response(PRIVACY, PRIVACY, 302)})
    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    assert report.outcomes[0].status is Status.FAILED
    assert "redirect" in report.outcomes[0].detail


def test_a_redirect_without_a_location_fails(repo):
    routes = base_routes(**{PRIVACY: response(PRIVACY, 302)})
    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    assert report.outcomes[0].status is Status.FAILED


# -- failures are reported and skipped --------------------------------------


def test_the_size_cap_drops_the_document(repo):
    def too_big(target, headers):
        raise SizeCapExceeded("response body exceeded 5242880 bytes")

    routes = base_routes(**{PRIVACY: too_big})
    before = commit_count(repo)
    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])

    assert report.outcomes[0].status is Status.FAILED
    assert not (repo / "documents" / "example" / "privacy.txt").exists()
    assert commit_count(repo) == before


def test_the_cap_is_passed_to_the_transport(repo):
    transport = FakeTransport(base_routes())
    make_crawler(repo, transport, max_bytes=1234).run(only=["example"])
    assert transport.requests_for(PRIVACY)[0].max_bytes == 1234
    # robots.txt gets its own, smaller cap
    assert transport.requests_for("https://example.com/robots.txt")[0].max_bytes == 512 * 1024


@pytest.mark.parametrize("status", [403, 404, 500])
def test_a_bad_status_is_reported_and_skipped(repo, status):
    routes = base_routes(**{PRIVACY: response(PRIVACY, status)})
    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    assert report.outcomes[0].status is Status.FAILED
    assert str(status) in report.outcomes[0].detail


def test_a_non_textual_response_is_skipped(repo):
    routes = base_routes(
        **{PRIVACY: response(PRIVACY, 200, {"Content-Type": "application/pdf"}, b"%PDF-1.7")}
    )
    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    assert report.outcomes[0].status is Status.FAILED


def test_an_empty_extraction_is_skipped(repo):
    routes = base_routes(
        **{PRIVACY: response(PRIVACY, 200, {"Content-Type": "text/html"}, b"<html></html>")}
    )
    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    assert report.outcomes[0].status is Status.FAILED
    assert not (repo / "documents" / "example" / "privacy.txt").exists()


def test_a_collapsed_extraction_is_skipped(repo):
    routes = base_routes(
        **{
            PRIVACY: response(
                PRIVACY,
                200,
                {"Content-Type": "text/html"},
                b"<html><body><article><p>Please enable JavaScript.</p></article></body></html>",
            )
        }
    )
    report = make_crawler(repo, FakeTransport(routes)).run(only=["example"])
    assert report.outcomes[0].status is Status.FAILED
    assert "characters" in report.outcomes[0].detail


def test_an_extractor_crash_drops_only_that_document(repo, monkeypatch):
    """trafilatura raising on one pathological page must not end the crawl."""
    real = crawl_module.extract_text

    def boom(payload: bytes, url: str):
        if "example.com" in url:
            raise RecursionError("maximum recursion depth exceeded")
        return real(payload, url)

    monkeypatch.setattr(crawl_module, "extract_text", boom)
    report = make_crawler(repo, FakeTransport(base_routes())).run()

    assert report.counts()["failed"] == 1
    assert report.counts()["changed"] == 1
    assert "RecursionError" in report.of_status(Status.FAILED)[0].detail
    assert (repo / "documents" / "other" / "tos.txt").exists()


def test_one_failure_does_not_stop_the_crawl(repo):
    routes = base_routes(**{PRIVACY: response(PRIVACY, 500)})
    report = make_crawler(repo, FakeTransport(routes)).run()

    assert report.counts()["failed"] == 1
    assert report.counts()["changed"] == 1
    assert (repo / "documents" / "other" / "tos.txt").exists()


# -- politeness -------------------------------------------------------------


def test_requests_to_one_host_are_spaced(repo):
    write_catalog(
        repo,
        [
            {
                "slug": "example",
                "name": "Example",
                "website_url": "https://example.com",
                "category": "other",
                "policy_urls": {
                    "privacy": PRIVACY,
                    "tos": "https://example.com/terms",
                },
            }
        ],
    )
    routes = base_routes(
        **{"https://example.com/terms": html_response("https://example.com/terms")}
    )
    sleeper = SleepRecorder()
    politeness = Politeness(delay=2.5, sleep=sleeper, monotonic=lambda: 0.0)
    make_crawler(repo, FakeTransport(routes), politeness=politeness).run()

    # robots, then two documents: two waits on the same host.
    assert sleeper.calls == [2.5, 2.5]


def test_a_longer_crawl_delay_from_robots_wins(repo):
    routes = base_routes(
        **{
            "https://example.com/robots.txt": robots_response(
                "https://example.com/robots.txt",
                "User-agent: inplainbot\nCrawl-delay: 9\nAllow: /\n",
            )
        }
    )
    sleeper = SleepRecorder()
    politeness = Politeness(delay=2.0, sleep=sleeper, monotonic=lambda: 0.0)
    make_crawler(repo, FakeTransport(routes), politeness=politeness).run(only=["example"])

    assert sleeper.calls == [9.0]


def test_an_absurd_crawl_delay_drops_the_host(repo):
    """AC-1: the crawl completes. One misconfigured host may not stall it."""
    routes = base_routes(
        **{
            "https://example.com/robots.txt": robots_response(
                "https://example.com/robots.txt",
                "User-agent: *\nCrawl-delay: 86400\nAllow: /\n",
            )
        }
    )
    sleeper = SleepRecorder()
    politeness = Politeness(delay=2.0, sleep=sleeper, monotonic=lambda: 0.0)
    transport = FakeTransport(routes)
    report = make_crawler(repo, transport, politeness=politeness).run(only=["example"])

    assert report.outcomes[0].status is Status.BLOCKED
    assert "Crawl-delay" in report.outcomes[0].detail
    assert PRIVACY not in transport.urls
    assert sleeper.calls == []


def test_a_zero_delay_never_sleeps(repo):
    sleeper = SleepRecorder()
    politeness = Politeness(delay=0.0, sleep=sleeper, monotonic=lambda: 0.0)
    make_crawler(repo, FakeTransport(base_routes()), politeness=politeness).run()
    assert sleeper.calls == []


# -- catalog and CLI --------------------------------------------------------


def test_only_restricts_the_crawl(repo):
    transport = FakeTransport(base_routes())
    report = make_crawler(repo, transport).run(only=["other"])

    assert [str(o.document) for o in report.outcomes] == ["other/tos"]
    assert not any("example.com" in url for url in transport.urls)


def test_an_unknown_slug_is_refused(repo):
    with pytest.raises(ValueError, match="nope"):
        make_crawler(repo, FakeTransport(base_routes())).run(only=["nope"])


def test_the_real_catalog_flattens_to_30_companies_and_52_documents():
    # 2026-08-20: amazon (403), ebay/tos and microsoft/privacy (robots)
    # were dropped after the first honest crawl — see catalog.json history.
    documents = load_catalog(Path(__file__).resolve().parent.parent / "catalog.json")
    assert len(documents) == 52
    assert len({d.company for d in documents}) == 30
    assert all(d.url.startswith("https://") for d in documents)
    assert all(d.relpath == f"documents/{d.company}/{d.doc}.txt" for d in documents)


def test_a_malformed_catalog_is_refused(tmp_path):
    path = tmp_path / "catalog.json"
    path.write_text('[{"slug": "x", "name": "X"}]', encoding="utf-8")
    with pytest.raises(ValueError):
        load_catalog(path)


def test_a_catalog_with_non_object_policy_urls_is_refused(tmp_path):
    """main() aborts on ValueError; anything else is a traceback at the user."""
    path = tmp_path / "catalog.json"
    path.write_text(
        '[{"slug": "x", "name": "X", "policy_urls": "https://x.test/privacy"}]',
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="policy_urls"):
        load_catalog(path)


def test_cli_flags():
    args = build_parser().parse_args(["--no-commit", "--only", "google", "--only", "meta"])
    assert args.no_commit is True
    assert args.only == ["google", "meta"]

    default = build_parser().parse_args([])
    assert default.no_commit is False
    assert default.only is None
    assert default.delay > 0


def test_there_is_no_documents_flag():
    """documents/ outside the repository would store validators for Snapshots
    git never held; the crawl always writes the repository's documents/."""
    with pytest.raises(SystemExit):
        build_parser().parse_args(["--documents", "elsewhere"])
