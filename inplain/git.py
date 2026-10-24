"""The git datastore: one runner, one error, and the Snapshot commit message.

A Snapshot is a commit of exactly one ``documents/<company>/<doc>.txt``; T1
(``inplain.crawl``) writes it and T2 (``inplain.detect``) reads the history
back. The commit message is an interface between the two, so its writer
(:func:`commit_message`) and its parser (:func:`message_identity`) live here,
side by side.
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from .crawl import Document

_MESSAGE_COMPANY = re.compile(r"^company:\s*(?P<name>.+?)\s*\((?P<slug>[^)]+)\)\s*$", re.M)
_MESSAGE_URL = re.compile(r"^url:\s*(?P<url>\S+)\s*$", re.M)


class GitError(RuntimeError):
    pass


def commit_message(document: Document) -> str:
    return (
        f"crawl: {document.company}/{document.doc}\n"
        "\n"
        f"company: {document.company_name} ({document.company})\n"
        f"doc: {document.doc}\n"
        f"url: {document.url}\n"
    )


def message_identity(message: str) -> tuple[str | None, str | None]:
    """(company_name, url) as :func:`commit_message` wrote them, or None for
    a line the message lacks (a hand-made commit)."""
    name = _MESSAGE_COMPANY.search(message)
    url = _MESSAGE_URL.search(message)
    return (name.group("name") if name else None, url.group("url") if url else None)


class Git:
    """The datastore. Thin, on purpose: commit one path, read history back."""

    def __init__(self, root: Path) -> None:
        self.root = Path(root)

    def _run(self, *args: str) -> bytes:
        result = subprocess.run(
            ["git", "-C", str(self.root), "-c", "core.quotepath=false", *args],
            capture_output=True,
        )
        if result.returncode != 0:
            output = result.stderr.strip() or result.stdout.strip()
            raise GitError(
                f"git {' '.join(args)} failed ({result.returncode}): "
                f"{output.decode('utf-8', 'replace')}"
            )
        return result.stdout

    # -- writing (T1) -------------------------------------------------------

    def head(self) -> str:
        return self._run("rev-parse", "HEAD").decode("ascii", "replace").strip()

    def has_changes(self, relpath: str) -> bool:
        """True when the working tree copy differs from what is committed."""
        return bool(self._run("status", "--porcelain", "--", relpath).strip())

    def commit_path(self, relpath: str, message: str) -> str:
        """Stage and commit exactly one path, and nothing else.

        The pathspec on ``commit`` is what keeps a document commit to a single
        document, so T2 can map a commit to the document it snapshots.
        """
        self._run("add", "--", relpath)
        self._run("commit", "--no-verify", "-m", message, "--", relpath)
        return self.head()

    # -- reading (T2) -------------------------------------------------------

    def document_commits(self, docs_relpath: str) -> list[tuple[str, str, str, list[str]]]:
        """(sha, author_date_iso, message, files) for every commit that
        touched ``docs_relpath``, oldest first."""
        out = self._run(
            "log",
            "--reverse",
            "--format=%x1e%H%x1f%aI%x1f%B%x1f",
            "--name-only",
            "--",
            docs_relpath,
        ).decode("utf-8", "replace")
        commits = []
        for chunk in out.split("\x1e"):
            if not chunk.strip():
                continue
            sha, author_date, message, names = chunk.split("\x1f", 3)
            files = [line.strip() for line in names.splitlines() if line.strip()]
            commits.append((sha.strip(), author_date.strip(), message, files))
        return commits

    def parent_sha(self, sha: str) -> str | None:
        """The first parent's full sha, or None for a root commit."""
        try:
            out = self._run("rev-parse", "--verify", "--quiet", f"{sha}^")
        except GitError:
            return None
        return out.decode("ascii", "replace").strip() or None

    def path_exists_at(self, sha: str, relpath: str) -> bool:
        try:
            self._run("cat-file", "-e", f"{sha}:{relpath}")
            return True
        except GitError:
            return False

    def blob_text(self, sha: str, relpath: str) -> str:
        return self._run("show", f"{sha}:{relpath}").decode("utf-8", "replace")
