# Repository conventions (rebuild)

Governed by `SPEC.md` v0.3. This file exists so independent tickets converge on
one layout. KISS, YAGNI, delete by default.

## Layout

```
catalog.json                 # 32 companies / 56 URLs — the curated input
inplain/                     # ONE Python package, stdlib-leaning
  __init__.py
  crawl.py                   # T1: catalog → fetch → extract → write documents/
  net.py                     # T1: SSRF-safe, IP-pinned, size-capped transport
  robots.py                  # T1: protego robots.txt, per origin, fail-closed
  detect.py                  # T2: git diff → change records
  summarize.py               # T3: cited summaries + side-aware validation
  site.py                    # T4: static site generator → _site/
  feeds.py                   # T5: Atom feeds → _site/
  schema.py                  # change-record dataclasses + validation
                             #   (normative: docs/decisions/G1-*.md)
tests/                       # pytest; network is ALWAYS mocked in tests
eval/                        # R2: golden set + harness
  golden/*.json
  run_eval.py
templates/                   # site templates (if any)
static/
  tokens.css                 # D1: the token layer — ALL raw values live here
  site.css                   # semantic CSS, var(--*) references only
documents/<company>/<doc>.txt  # crawler output; a change is a commit
changes/<id>.json            # change records (schema_version 1)
docs/                        # decisions, hosting, model eval
.github/workflows/           # T6: ci.yml (push), crawl.yml (schedule)
requirements.txt             # pinned == versions
requirements-dev.txt         # pytest etc., pinned
package.json                 # dev-only: stylelint + axe for CI. No runtime Node.
_site/                       # build output — gitignored
```

## Rules

- **Python 3.13**, `requests` + `protego` + `trafilatura` for the crawler,
  `jinja2` allowed for templating. No framework, no database, no server.
- Dependencies pinned exactly; add nothing without need.
- Tests never touch the network (`responses` or monkeypatched session).
- Every module runnable as `python -m inplain.<module>`; CI composes them.
- CSS: no raw hex/px outside `static/tokens.css` (stylelint-enforced).
- Site output is fully static, readable with JS disabled (AC-7).
- Commit style on this branch: one coherent commit per ticket,
  `T1: …` / `D1: …` prefixes.
