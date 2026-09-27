"""inplain.ai — a public, permanent record of how policy documents change.

See SPEC.md. One package, stdlib-leaning, no framework, no database: git is
the datastore.
"""

import logging, sys
from pathlib import Path

__all__ = ["REPO_ROOT", "__version__", "setup_cli_logging"]

__version__ = "0.3.0"

# The checkout this package lives in: every stage's default --root.
REPO_ROOT = Path(__file__).resolve().parent.parent


def setup_cli_logging(log: logging.Logger, verbose: bool) -> None:
    """Root stays at WARNING so trafilatura's per-paragraph debug chatter does
    not drown the log; the stage's own logger is the one --verbose opens up."""
    logging.basicConfig(
        level=logging.WARNING, format="%(levelname)s %(message)s", stream=sys.stderr
    )
    log.setLevel(logging.DEBUG if verbose else logging.INFO)
