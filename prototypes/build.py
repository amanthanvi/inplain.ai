"""Render the same real Change record in every design direction (#37).

Throwaway. Reads ``sample-hunks.json`` (Google's privacy policy, first-party
archived 2026-04-02 against 2026-08-03: 18 Hunks, a ~900-character replaced
paragraph among them) plus ``catalog.json``, and writes, per direction,

    out/<dir>/change.html     the Change record, with a cited Summary
    out/<dir>/wordmarks.html  the two long replaced Hunks, without and with
                              word-level marks (feeds #38)
    out/<dir>/home.html       the homepage in its empty state (the launch state)
    out/<dir>/company.html    the Google Company page, one record on file
    out/<dir>/changes.html    the Change record index

Direction A is the incumbent: the real templates' markup with the real
``static/tokens.css`` + ``static/site.css``. The others are fresh worlds.
Every quote in the sample Summary is checked against its Side, the way the
product checks Citations, so the prototypes never show an evidence link the
pipeline could not have produced.

Usage: python prototypes/build.py
"""

from __future__ import annotations

import difflib
import html
import json
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).parent
OUT = ROOT / "out"
HUNKS = json.loads((ROOT / "sample-hunks.json").read_text())
CATALOG = json.loads((ROOT.parent / "catalog.json").read_text())

DOC_TITLES = {"privacy": "Privacy Policy", "tos": "Terms of Service", "terms": "Terms of Service", "cookies": "Cookie Policy"}

META = {
    "company": "Google",
    "slug": "google",
    "doc": "Privacy Policy",
    "from_version": "2026-04-02",
    "to_version": "2026-08-03",
    "source": "https://policies.google.com/privacy",
    "source_host": "policies.google.com",
    "added_chars": sum(len("".join(h["added"])) for h in HUNKS),
    "removed_chars": sum(len("".join(h["removed"])) for h in HUNKS),
    "hunks": len(HUNKS),
    "similarity": "0.94",
    "unchanged_pct": "93.6%",
    "record_id": "google-privacy-4f2a1c9",
}
WATCH_SINCE = "2026-09-27"

# The Summary, in the shape summarize.py emits: Claims, each with Citations
# that name a Hunk (0-based here; labelled 1-based) and a Side, and quote the
# line verbatim. Hand-written from the real diff.
CLAIMS = [
    {
        "text": "Google broadened one collected category: “Voice and audio information” is now “Media (like images, files, audio and video) from your interactions”.",
        "citations": [
            {"hunk": 3, "side": "added", "quote": "Media (like images, files, audio and video) from your interactions"},
            {"hunk": 3, "side": "removed", "quote": "Voice and audio information"},
        ],
    },
    {
        "text": "A new sentence states outright that Google collects and uses data that is not associated with your account.",
        "citations": [
            {"hunk": 2, "side": "added", "quote": "Google also collects and uses data that is not associated with your account."},
        ],
    },
    {
        "text": "Activity you can find and manage is now described as saved “in your history” rather than “by your activity controls”.",
        "citations": [
            {"hunk": 4, "side": "added", "quote": "saved in your history"},
            {"hunk": 4, "side": "removed", "quote": "saved by your activity controls"},
        ],
    },
    {
        "text": "Location-linked activity is now saved “as history”, and a new Search Services History is named alongside Web & App Activity.",
        "citations": [
            {"hunk": 5, "side": "added", "quote": "activity from services like Search, Maps, and Shopping is saved to Search Services History"},
        ],
    },
    {
        "text": "The “Activity Controls” section became “Personalization and Activity Controls”, and now covers AI Mode interactions and personalized recommendations.",
        "citations": [
            {"hunk": 8, "side": "added", "quote": "Personalization and Activity Controls"},
            {"hunk": 8, "side": "added", "quote": "resume an AI Mode interaction where you left off"},
        ],
    },
]


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().casefold()


for claim in CLAIMS:
    for c in claim["citations"]:
        lines = HUNKS[c["hunk"]][c["side"]]
        if not any(_norm(c["quote"]) in _norm(line) for line in lines):
            raise SystemExit(f"citation does not validate: {c}")

CITED = {}  # hunk index -> list of claim indexes
for ci, claim in enumerate(CLAIMS):
    for c in claim["citations"]:
        CITED.setdefault(c["hunk"], [])
        if ci not in CITED[c["hunk"]]:
            CITED[c["hunk"]].append(ci)

# --------------------------------------------------------------- word spans
# The candidate build-time computation for #38: token diff of the removed
# text against the added text of one Hunk, expressed as character offsets
# into the plain line text (G1's reserved shape). Marks are presentation;
# Citations keep validating against whole lines on their Side.

_TOKEN = re.compile(r"\s+|\w+|[^\w\s]")


def _tokens(s: str) -> list[tuple[int, int]]:
    return [(m.start(), m.end()) for m in _TOKEN.finditer(s)]


def _per_line(lines: list[str], spans: list[tuple[int, int]]) -> list:
    out, offset = [], 0
    for li, line in enumerate(lines):
        lo, hi = offset, offset + len(line)
        local = []
        for s, e in spans:
            s2, e2 = max(s, lo), min(e, hi)
            seg = line[s2 - lo : e2 - lo] if s2 < e2 else ""
            if seg.strip():
                lead = len(seg) - len(seg.lstrip())
                trail = len(seg) - len(seg.rstrip())
                local.append([s2 - lo + lead, e2 - lo - trail])
        if local:
            out.append([li, local])
        offset = hi + 1
    return out


def word_spans(removed: list[str], added: list[str]) -> dict | None:
    """G1-shaped spans, or None when the sides are too different to align."""
    if not removed or not added:
        return None
    a, b = "\n".join(removed), "\n".join(added)
    ta, tb = _tokens(a), _tokens(b)
    sm = difflib.SequenceMatcher(None, [a[s:e] for s, e in ta], [b[s:e] for s, e in tb], autojunk=False)
    if sm.ratio() < 0.5:
        return None
    rem, add = [], []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op in ("replace", "delete") and i1 < i2:
            rem.append((ta[i1][0], ta[i2 - 1][1]))
        if op in ("replace", "insert") and j1 < j2:
            add.append((tb[j1][0], tb[j2 - 1][1]))
    return {"removed": _per_line(removed, rem), "added": _per_line(added, add)}


SPANS = {i: word_spans(h["removed"], h["added"]) for i, h in enumerate(HUNKS)}


def esc(s: str) -> str:
    return html.escape(s, quote=False)


def mark_text(text: str, spans: list[tuple[int, int, str]]) -> str:
    """Wrap (start, end, kind) spans; kinds nest as mark > del/ins."""
    cuts = sorted({0, len(text), *[s for s, _, _ in spans], *[e for _, e, _ in spans]})
    out = []
    for a, b in zip(cuts, cuts[1:]):
        kinds = [k for s, e, k in spans if s <= a and b <= e]
        seg = esc(text[a:b])
        if "del" in kinds:
            seg = f"<del>{seg}</del>"
        if "ins" in kinds:
            seg = f"<ins>{seg}</ins>"
        if "q" in kinds:
            seg = f'<mark class="q">{seg}</mark>'
        out.append(seg)
    return "".join(out)


def line_spans(i: int, side: str, li: int, line: str, marks: bool, quotes: bool) -> list:
    spans = []
    if marks and SPANS[i]:
        for lidx, ranges in SPANS[i][side]:
            if lidx == li:
                spans += [(s, e, "del" if side == "removed" else "ins") for s, e in ranges]
    if quotes:
        for ci in CITED.get(i, []):
            for c in CLAIMS[ci]["citations"]:
                if c["hunk"] == i and c["side"] == side:
                    pos = line.find(c["quote"])
                    if pos >= 0:
                        spans.append((pos, pos + len(c["quote"]), "q"))
    return spans


def stacked_rows(i: int, *, marks: bool, quotes: bool, context: bool = False) -> str:
    """Removed lines, then added lines, each with a gutter mark and a hidden label."""
    h = HUNKS[i]
    rows = []
    if context:
        for line in h["before"]:
            rows.append(f'<div class="ln cx"><span class="mk" aria-hidden="true"></span><span class="sr">Context:</span> <span class="tx">{esc(line)}</span></div>')
    for side, cls, mk, label in (("removed", "rm", "−", "Removed:"), ("added", "ad", "+", "Added:")):
        for li, line in enumerate(h[side]):
            body = mark_text(line, line_spans(i, side, li, line, marks, quotes))
            rows.append(f'<div class="ln {cls}"><span class="mk" aria-hidden="true">{mk}</span><span class="sr">{label}</span> <span class="tx">{body}</span></div>')
    if context:
        for line in h["after"]:
            rows.append(f'<div class="ln cx"><span class="mk" aria-hidden="true"></span><span class="sr">Context:</span> <span class="tx">{esc(line)}</span></div>')
    return "\n".join(rows)


def inline_redline(i: int, *, quotes: bool) -> str:
    """One merged paragraph: removed words struck, added words underlined."""
    h = HUNKS[i]
    a, b = "\n".join(h["removed"]), "\n".join(h["added"])
    ta, tb = _tokens(a), _tokens(b)
    sm = difflib.SequenceMatcher(None, [a[s:e] for s, e in ta], [b[s:e] for s, e in tb], autojunk=False)
    out = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            out.append(esc(a[ta[i1][0] : ta[i2 - 1][1]]))
            continue
        if op in ("replace", "delete") and i1 < i2:
            out.append(f'<del><span class="sr">Removed:</span> {esc(a[ta[i1][0]:ta[i2 - 1][1]])}</del>')
        if op in ("replace", "insert") and j1 < j2:
            out.append(f'<ins><span class="sr">Added:</span> {esc(b[tb[j1][0]:tb[j2 - 1][1]])}</ins>')
    return "".join(out)


def kind(h: dict) -> str:
    return {"replace": "replaced", "delete": "removed", "insert": "added"}[h["tag"]]


def n(x: int) -> str:
    return f"{x:,}"


# ------------------------------------------------------------------ shells

SR = ".sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}"
COMPANIES = sorted(CATALOG, key=lambda c: c["name"].casefold())
DOC_COUNT = sum(len(c["policy_urls"]) for c in CATALOG)
GOOGLE = next(c for c in CATALOG if c["slug"] == "google")


def doc_list(c: dict) -> str:
    return ", ".join(DOC_TITLES.get(k, k.title()) for k in sorted(c["policy_urls"]))


def font_face(family: str, files: list[tuple[str, str | int, str]]) -> str:
    return "".join(
        f"@font-face{{font-family:'{family}';font-style:{style};font-weight:{weight};font-display:swap;src:url(../../fonts/{f}) format('woff2')}}"
        for f, weight, style in files
    )


def page(title: str, head: str, body: str, lang_note: str = "") -> str:
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>{esc(title)}</title>
{head}
</head><body>{body}</body></html>"""


# =============================================================== direction A
# The incumbent: real templates, real stylesheets (linked, not copied).

A_HEAD = '<link rel="stylesheet" href="../../../static/tokens.css"><link rel="stylesheet" href="../../../static/site.css">'
A_MARKS = "<style>del{text-decoration:line-through;text-decoration-thickness:1.5px}ins{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;font-weight:700}</style>"


def a_shell(main: str, latest: bool = True, nav: str = "") -> str:
    foot = f"<span>1 change record · latest {META['to_version']}</span>" if latest else ""
    cur = lambda k: ' aria-current="page"' if nav == k else ""
    return f"""<a class="skip" href="#main">Skip to content</a>
<header class="masthead"><div class="wrap"><a class="site-name" href="#">inplain.ai</a>
<nav class="site-nav" aria-label="Site"><a href="#"{cur("changes")}>Changes</a><a href="#"{cur("companies")}>Companies</a></nav></div></header>
<main id="main"><div class="wrap">{main}</div></main>
<footer class="site-foot"><div class="wrap"><span>inplain.ai — what changed, why it matters, and the evidence.</span>{foot}</div></footer>"""


def a_hunk(i: int, marks: bool = False) -> str:
    h = HUNKS[i]
    return f'''<section class="hunk" id="h{i + 1}">
<div class="hh"><span class="hid">H{i + 1}</span><span>{h["tag"]}</span><span>old line {120 + i * 7} · new line {121 + i * 8}</span></div>
<div class="hb">
{stacked_rows(i, marks=marks, quotes=False, context=True)}
</div></section>'''


def a_bullets(prefix: str = "") -> str:
    items = []
    for c in CLAIMS:
        hunks = dict.fromkeys(x["hunk"] for x in c["citations"])
        cites = "".join(f' <a class="cit" href="{prefix}#h{h + 1}" title="Jump to the changed passage">[H{h + 1}]</a>' for h in hunks)
        items.append(f"<li>{esc(c['text'])}{cites}</li>")
    return "\n".join(items)


def a_feed_item() -> str:
    return f'''<li class="item">
<p class="item-meta"><span class="when"><time datetime="{META["to_version"]}">{META["to_version"]}</time></span> <a class="who" href="company.html">Google</a> <span class="doct">Privacy Policy</span></p>
<h3 class="headline"><a href="change.html">Google changed its Privacy Policy</a></h3>
<ul class="sum">{a_bullets("change.html")}</ul>
<p class="stats"><span class="plus"><span class="n">+{n(META["added_chars"])}</span> added</span> <span class="minus"><span class="n">−{n(META["removed_chars"])}</span> removed</span> <span><span class="n">18</span> passages</span> <span class="badge">similarity {META["similarity"]}</span></p>
</li>'''


def a_change() -> str:
    main = f'''<article>
<p class="kicker"><span class="tick"></span><a class="co" href="company.html">Google</a> <span>· Privacy Policy</span></p>
<h1>Google changed its Privacy Policy</h1>
<div class="meta"><span class="plus"><span class="n">+{n(META["added_chars"])}</span> added</span><span class="minus"><span class="n">−{n(META["removed_chars"])}</span> removed</span><span><span class="n">18</span> passages</span><span class="badge">similarity {META["similarity"]}</span><span class="span">detected <time datetime="{META["to_version"]}">{META["to_version"]}</time></span></div>
<h2>What changed</h2>
<ul class="sum">{a_bullets()}</ul>
<p>This summary covers 5 of 18 changed passages; the remaining passages appear below without a summary claim.</p>
<h2>The changed passages</h2>
{"".join(a_hunk(i) for i in range(len(HUNKS)))}
<p class="src">We publish the changed passages only — never the full document. Full policy at <a href="{META["source"]}" rel="external">{META["source_host"]}</a> — we link, we don't republish.</p>
</article>'''
    return page("Google Privacy Policy — change of 2026-08-03 · inplain.ai", A_HEAD, a_shell(main, nav="changes"))


def a_wordmarks() -> str:
    main = "<h1>Word-level marks (A)</h1><p class=\"lede\">Passages 2 and 6, as line-level marks (today), then with word-level marks.</p>"
    for i in (1, 5):
        main += f"<h2>Passage {i + 1} · line-level (today)</h2>{a_hunk(i)}<h2>Passage {i + 1} · with word-level marks</h2>{a_hunk(i, marks=True)}"
    return page("Word marks · A", A_HEAD + A_MARKS, a_shell(main))


def a_home() -> str:
    main = '''<h1>Recent changes</h1>
<p class="lede">A public record of how the privacy policies and terms of well-known companies change: the changed passages, a summary that cites them, and a link to the source.</p>
<p>No material changes recorded yet. The <a href="#">tracked companies</a> are being watched; changes appear here as they are detected.</p>'''
    return page("inplain.ai — the record of policy changes", A_HEAD, a_shell(main, latest=False))


def a_company() -> str:
    docs = "".join(
        f'<li><span class="doc-name">{DOC_TITLES.get(k, k)}</span>{" <span>last change <time datetime=%s>%s</time></span>" % (META["to_version"], META["to_version"]) if k == "privacy" else ""} <span class="doc-src"><a href="{u}" rel="external">source</a></span></li>'
        for k, u in sorted(GOOGLE["policy_urls"].items())
    )
    main = f'''<div class="co-head"><p class="kicker"><span class="tick"></span><span class="co">Google</span></p><h1>Google</h1></div>
<h2>Tracked documents</h2><ul class="docs">{docs}</ul>
<h2>Change history</h2><ul class="feed">{a_feed_item()}</ul>'''
    return page("Google — tracked policies · inplain.ai", A_HEAD, a_shell(main, nav="companies"))


def a_changes() -> str:
    main = f'''<h1>All changes</h1>
<nav aria-label="Filter by company"><h2>By company</h2><p class="stats"><span><a href="company.html">Google</a> <span class="badge">1</span></span></p></nav>
<h2>Every material change, newest first</h2><ul class="feed">{a_feed_item()}</ul>'''
    return page("All changes · inplain.ai", A_HEAD, a_shell(main, nav="changes"))


# =============================================================== direction D
# "Register": a civil register. White paper, black ink, one teal accent for
# links, Literata for everything including the diff. Each Claim is followed
# by the passages it cites, so evidence sits under its claim; the remaining
# passages follow in document order. The cited quote is highlighted inside
# the passage like a highlighter pen on a record.

# The upright file is the variable font (weight axis 400–900); the italic is a static 400.
D_FONTS = font_face("Literata", [("Literata-latin.woff2", "400 700", "normal"), ("Literata-italic-latin.woff2", 400, "italic")])
D_CSS = D_FONTS + SR + """
:root{--paper:#fff;--ink:#141414;--soft:#3d3d3d;--muted:#666;--rule:#d4d4d4;--rule-soft:#ebebeb;--accent:#0b6666;
  --add-bg:#e9f5ec;--add-ink:#0e5a2b;--add-line:#2e8b4c;--rm-bg:#fbeaea;--rm-ink:#8c1d1d;--rm-line:#c33;--hl:#fff3b0;--hl-ink:#141414;--focus:#0b6666}
@media (prefers-color-scheme:dark){:root{--paper:#17191c;--ink:#ececec;--soft:#cfcfcf;--muted:#9d9d9d;--rule:#34373b;--rule-soft:#26292d;--accent:#7fd6d6;
  --add-bg:#12301c;--add-ink:#9ee2b6;--add-line:#4fbf78;--rm-bg:#3a1719;--rm-ink:#f5b0b0;--rm-line:#e07070;--hl:#4a4212;--hl-ink:#f3eac0;--focus:#7fd6d6}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);font-family:Literata,Georgia,serif;font-size:17px;line-height:1.6;font-variant-numeric:tabular-nums}
main{flex:1 0 auto}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:3px}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
::selection{background:var(--hl);color:var(--hl-ink)}
.skip{position:absolute;left:8px;top:8px;padding:8px 12px;background:var(--paper);border:1px solid var(--rule);transform:translateY(-200%)}
.skip:focus-visible{transform:none}
.wrap{max-width:72ch;margin:0 auto;padding:0 24px}
.masthead .wrap,.foot .wrap{display:flex;gap:24px;align-items:baseline;padding-top:20px;padding-bottom:20px}
.masthead{border-bottom:1px solid var(--rule)}
.brand{color:var(--ink);text-decoration:none;font-weight:700;font-size:18px}
.nav{margin-left:auto;display:flex;gap:20px;font-size:15px}
.nav a{color:var(--soft);text-decoration:none}
.nav a[aria-current],.nav a:hover{color:var(--ink);text-decoration:underline}
main .wrap{padding-top:48px;padding-bottom:96px}
.foot{border-top:1px solid var(--rule);font-size:14px;color:var(--muted)}
.foot .wrap{flex-wrap:wrap}
h1{font-size:34px;line-height:1.15;font-weight:600;letter-spacing:-.01em;margin:0 0 12px;text-wrap:balance}
.crumb{font-size:15px;color:var(--muted);margin:0 0 20px}
.crumb a{color:var(--ink)}
.facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 20px;margin:24px 0 40px;padding:16px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);font-size:15px}
.facts dt{color:var(--muted);margin:0}
.facts dd{margin:0}
.facts .plus{color:var(--add-ink);font-weight:600}
.facts .minus{color:var(--rm-ink);font-weight:600}
h2{font-size:22px;font-weight:600;margin:48px 0 16px;letter-spacing:-.005em}
.lede{font-size:19px;line-height:1.5;color:var(--soft);margin:0 0 24px;max-width:60ch;text-wrap:pretty}
ol.claims{list-style:none;margin:0;padding:0;counter-reset:claim}
.claim{border-top:1px solid var(--rule);padding:24px 0 8px;counter-increment:claim}
.claim-text{display:grid;grid-template-columns:2.4em 1fr;gap:0;font-size:18px;line-height:1.5;margin:0 0 16px;text-wrap:pretty}
.claim-text::before{content:counter(claim);font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.evidence{margin:0 0 16px 2.4em}
.ev-label{font-size:14px;color:var(--muted);margin:0 0 6px}
.ev-label a{color:var(--ink)}
.hunk{border:1px solid var(--rule);margin:0 0 16px;scroll-margin-top:24px}
.hunk:target{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
.hh{display:flex;flex-wrap:wrap;gap:6px 16px;padding:8px 14px;border-bottom:1px solid var(--rule-soft);font-size:14px;color:var(--muted)}
.hh b{color:var(--ink);font-weight:600}
.hh .back a{color:var(--accent)}
.ln{display:grid;grid-template-columns:1.6ch 1fr;gap:8px;padding:8px 14px;white-space:pre-wrap;overflow-wrap:break-word;line-height:1.55;font-size:16px}
.ln.rm{background:var(--rm-bg);color:var(--rm-ink)}
.ln.ad{background:var(--add-bg);color:var(--add-ink)}
.ln.cx{color:var(--muted);font-size:15px}
.ln+.ln{border-top:1px solid var(--paper)}
.mk{font-weight:700;text-align:center}
del{text-decoration:line-through;text-decoration-color:var(--rm-line);text-decoration-thickness:1.5px;background:rgba(200,60,60,.12)}
ins{text-decoration:underline;text-decoration-color:var(--add-line);text-decoration-thickness:2px;text-underline-offset:3px;font-weight:600;background:rgba(60,160,90,.12)}
mark.q{background:var(--hl);color:var(--hl-ink);box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:1px 0;border-bottom:2px solid var(--accent)}
.legend{font-size:14px;color:var(--muted);margin:0 0 16px}
.rest .hunk{margin-bottom:16px}
.source{margin-top:40px;font-size:15px;color:var(--muted);border-top:1px solid var(--rule);padding-top:16px}
.register{list-style:none;margin:0;padding:0;columns:2;column-gap:40px}
.register li{break-inside:avoid;padding:8px 0;border-bottom:1px solid var(--rule-soft);font-size:15px}
.register b{font-weight:600;display:block}
.register span{color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:15px}
th,td{text-align:left;padding:10px 0;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-weight:600;color:var(--muted);font-size:14px}
td.num{text-align:right;font-variant-numeric:tabular-nums}
.entry{border-top:1px solid var(--rule);padding:24px 0}
.entry .when{font-size:15px;color:var(--muted);margin:0 0 6px}
.entry h3{font-size:22px;margin:0 0 10px;font-weight:600;line-height:1.25}
.entry h3 a{color:var(--ink);text-decoration:none}
.entry h3 a:hover{text-decoration:underline}
.entry p{margin:0 0 8px;text-wrap:pretty}
.entry .counts{font-size:15px;color:var(--muted)}
.empty{border:1px solid var(--rule);padding:20px 24px;margin:0 0 40px;font-size:17px}
.empty p{margin:0 0 8px}
.empty p:last-child{margin:0}
@media (max-width:40em){.wrap{padding:0 16px}h1{font-size:27px}.facts{grid-template-columns:1fr;gap:2px}.facts dt{margin-top:8px}.register{columns:1}.claim-text{grid-template-columns:1.8em 1fr}.evidence{margin-left:0}.ln{padding:8px 10px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media print{body{background:#fff;color:#000}.masthead,.foot,.skip{display:none}.hunk{break-inside:avoid;border-color:#000}.ln.rm,.ln.ad{background:#fff;color:#000}mark.q{background:#fff;border-bottom:2px solid #000}a{color:#000}}
"""


def d_shell(main: str, nav: str = "", latest: bool = True) -> str:
    cur = lambda k: ' aria-current="page"' if nav == k else ""
    foot = f"<span>1 change on record · latest {META['to_version']}</span>" if latest else f"<span>Watching {DOC_COUNT} documents from {len(CATALOG)} companies</span>"
    return f"""<a class="skip" href="#main">Skip to content</a>
<header class="masthead"><div class="wrap"><a class="brand" href="#">inplain.ai</a><nav class="nav" aria-label="Site"><a href="#"{cur("changes")}>Changes</a><a href="#"{cur("companies")}>Companies</a><a href="#">Feed</a></nav></div></header>
<main id="main"><div class="wrap">{main}</div></main>
<footer class="foot"><div class="wrap"><span>inplain.ai — what changed, why it matters, and the evidence.</span>{foot}</div></footer>"""


def d_hunk(i: int, *, marks: bool, quotes: bool, back: bool = False) -> str:
    h = HUNKS[i]
    cited = CITED.get(i, [])
    back_html = f'<span class="back">cited by claim {", ".join(str(c + 1) for c in cited)}</span>' if back and cited else ""
    return f'''<section class="hunk" id="p{i + 1}" aria-label="Passage {i + 1}">
<div class="hh"><span><b>Passage {i + 1}</b> of {META["hunks"]}</span><span>{kind(h)}</span><span>old line {120 + i * 7} · new line {121 + i * 8}</span>{back_html}</div>
{stacked_rows(i, marks=marks, quotes=quotes)}
</section>'''


def d_facts() -> str:
    return f'''<dl class="facts">
<dt>Compared</dt><dd>version of {META["from_version"]} against version of {META["to_version"]}</dd>
<dt>Passages changed</dt><dd>{META["hunks"]}, {META["unchanged_pct"]} of the text unchanged</dd>
<dt>Characters</dt><dd><span class="plus">+{n(META["added_chars"])}</span> added, <span class="minus">−{n(META["removed_chars"])}</span> removed</dd>
<dt>Source</dt><dd><a href="{META["source"]}" rel="external">{META["source_host"]}</a>, linked, not republished</dd>
</dl>'''


def d_change(marks: bool = True) -> str:
    claims = []
    for ci, c in enumerate(CLAIMS):
        hunks = list(dict.fromkeys(x["hunk"] for x in c["citations"]))
        ev = "".join(
            f'<div class="evidence">{d_hunk(h, marks=marks, quotes=True)}</div>'
            for h in hunks
        )
        claims.append(f'<li class="claim"><p class="claim-text">{esc(c["text"])}</p>{ev}</li>')
    rest = "".join(d_hunk(i, marks=marks, quotes=False) for i in range(len(HUNKS)) if i not in CITED)
    main = f'''<article>
<p class="crumb"><a href="company.html">Google</a> · Privacy Policy · detected <time datetime="{META["to_version"]}">{META["to_version"]}</time></p>
<h1>Google changed its Privacy Policy</h1>
{d_facts()}
<h2>What changed, with the evidence</h2>
<p class="legend">Five claims, each followed by the passage it cites. The cited words are highlighted; in a replaced passage, struck words were removed and underlined words were added.</p>
<ol class="claims">{"".join(claims)}</ol>
<h2 class="rest-h">The other {len(HUNKS) - len(CITED)} changed passages</h2>
<p class="legend">In document order. No claim in the summary cites these.</p>
<div class="rest">{rest}</div>
<p class="source">We publish the changed passages only, never the full document. The full policy is at <a href="{META["source"]}" rel="external">{META["source_host"]}</a>.</p>
</article>'''
    return page("Google Privacy Policy — change of 2026-08-03 · inplain.ai", f"<style>{D_CSS}</style>", d_shell(main, nav="changes"))


def d_wordmarks() -> str:
    main = '<h1>Word-level marks</h1><p class="lede">Passages 2 and 6, first with line-level marks only, then with word-level marks.</p>'
    for i in (1, 5):
        main += f"<h2>Passage {i + 1}, line-level only</h2>{d_hunk(i, marks=False, quotes=False)}<h2>Passage {i + 1}, with word-level marks</h2>{d_hunk(i, marks=True, quotes=False)}"
    return page("Word marks · D", f"<style>{D_CSS}</style>", d_shell(main))


def d_register() -> str:
    return '<ul class="register">' + "".join(f'<li><b>{esc(c["name"])}</b><span>{doc_list(c)}</span></li>' for c in COMPANIES) + "</ul>"


def d_home() -> str:
    main = f'''<h1>No policy has changed yet.</h1>
<p class="lede">inplain.ai keeps a public record of how the privacy policies and terms of service of well-known companies change: the changed passages, a summary that cites them, and a link to the source.</p>
<div class="empty"><p>Watching {DOC_COUNT} documents from {len(CATALOG)} companies since <time datetime="{WATCH_SINCE}">{WATCH_SINCE}</time>. Every document is read once a day.</p>
<p>The first material change will appear here and in the <a href="#">Atom feed</a>. Nothing is backfilled: the record starts now.</p></div>
<h2>The watched documents</h2>
{d_register()}'''
    return page("inplain.ai — the record of policy changes", f"<style>{D_CSS}</style>", d_shell(main, latest=False))


def d_entry() -> str:
    return f'''<article class="entry">
<p class="when"><time datetime="{META["to_version"]}">{META["to_version"]}</time> · <a href="company.html">Google</a> · Privacy Policy</p>
<h3><a href="change.html">Google changed its Privacy Policy</a></h3>
<p>{esc(CLAIMS[0]["text"])} <a href="change.html">Read all 5 claims and the evidence.</a></p>
<p class="counts">{META["hunks"]} passages changed · <span class="plus">+{n(META["added_chars"])}</span> / <span class="minus">−{n(META["removed_chars"])}</span> characters · {META["unchanged_pct"]} unchanged</p>
</article>'''


def d_company() -> str:
    rows = "".join(
        f'<tr><td>{DOC_TITLES.get(k, k)}</td><td>{"<time>" + META["to_version"] + "</time>" if k == "privacy" else "none since " + WATCH_SINCE}</td><td><a href="{u}" rel="external">{re.sub(r"^https?://", "", u).split("/")[0]}</a></td></tr>'
        for k, u in sorted(GOOGLE["policy_urls"].items())
    )
    main = f'''<p class="crumb"><a href="#">Companies</a> · Google</p>
<h1>Google</h1>
<p class="lede">{len(GOOGLE["policy_urls"])} documents watched. 1 material change on record.</p>
<h2>Watched documents</h2>
<table><thead><tr><th>Document</th><th>Last change</th><th>Source</th></tr></thead><tbody>{rows}</tbody></table>
<h2>Changes on record</h2>
{d_entry()}'''
    return page("Google — tracked policies · inplain.ai", f"<style>{D_CSS}</style>", d_shell(main, nav="companies"))


def d_changes() -> str:
    main = f'''<h1>All changes</h1>
<p class="lede">Every material change on record, newest first. 1 change from 1 company.</p>
<table><thead><tr><th>Company</th><th class="num">Changes</th></tr></thead><tbody><tr><td><a href="company.html">Google</a></td><td class="num">1</td></tr></tbody></table>
<h2>Newest first</h2>
{d_entry()}'''
    return page("All changes · inplain.ai", f"<style>{D_CSS}</style>", d_shell(main, nav="changes"))


# =============================================================== direction E
# "Redline": the lawyer's comparison document. Source Serif 4, white page.
# The changed passages read in document order; a replaced paragraph is one
# merged paragraph with removed words struck and added words underlined
# (the redline convention), and the Summary's Claims sit in the margin
# beside the passages they cite, like reviewer comments.

E_FONTS = font_face("Source Serif 4", [("Source_Serif_4-400-normal.woff2", 400, "normal"), ("Source_Serif_4-400-italic.woff2", 400, "italic"), ("Source_Serif_4-600-normal.woff2", 600, "normal"), ("Source_Serif_4-700-normal.woff2", 700, "normal")])
E_CSS = E_FONTS + SR + """
:root{--paper:#fff;--ink:#1a1a1a;--soft:#3a3a3a;--muted:#626262;--rule:#cfcfcf;--rule-soft:#e6e6e6;--del:#a3221d;--del-bg:#fbeeed;--ins:#1a4c9c;--ins-bg:#e9f0fb;--note:#f2f2f2;--accent:#1a4c9c;--focus:#1a4c9c}
@media (prefers-color-scheme:dark){:root{--paper:#1c1c1f;--ink:#ebebeb;--soft:#cfcfcf;--muted:#a3a3a3;--rule:#3d3d42;--rule-soft:#2c2c30;--del:#f39c96;--del-bg:#3b1e1c;--ins:#9cc0f5;--ins-bg:#1b2a45;--note:#27272b;--accent:#9cc0f5;--focus:#9cc0f5}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);font-family:"Source Serif 4",Georgia,serif;font-size:17px;line-height:1.65;font-variant-numeric:tabular-nums}
main{flex:1 0 auto}
a{color:var(--accent);text-underline-offset:3px}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
::selection{background:var(--ins-bg);color:var(--ink)}
.skip{position:absolute;left:8px;top:8px;padding:8px 12px;background:var(--paper);border:1px solid var(--rule);transform:translateY(-200%)}
.skip:focus-visible{transform:none}
.page{max-width:1120px;margin:0 auto;padding:0 24px}
.masthead{border-bottom:2px solid var(--ink)}
.masthead .page,.foot .page{display:flex;gap:24px;align-items:baseline;padding-top:18px;padding-bottom:18px}
.brand{color:var(--ink);text-decoration:none;font-weight:700;font-size:19px}
.nav{margin-left:auto;display:flex;gap:20px;font-size:15px}
.nav a{color:var(--soft);text-decoration:none}
.nav a[aria-current],.nav a:hover{color:var(--ink);text-decoration:underline}
main .page{padding-top:44px;padding-bottom:96px}
.foot{border-top:1px solid var(--rule);font-size:14px;color:var(--muted)}
.foot .page{flex-wrap:wrap}
.doc-head{max-width:66ch}
.row{display:grid;grid-template-columns:minmax(0,66ch) minmax(16rem,22rem);column-gap:48px;align-items:start}
.row>.hunk{grid-column:1;grid-row:1}
.row>.notes{grid-column:2;grid-row:1;position:sticky;top:12px}
.tail{max-width:66ch}
h1{font-size:36px;line-height:1.12;font-weight:700;letter-spacing:-.012em;margin:0 0 20px;text-wrap:balance}
.caption{font-size:15px;color:var(--muted);margin:0 0 12px}
.caption a{color:var(--ink)}
table.meta{border-collapse:collapse;width:100%;margin:0 0 36px;font-size:15px}
.meta th{text-align:left;font-weight:600;color:var(--muted);padding:8px 16px 8px 0;border-bottom:1px solid var(--rule-soft);width:11em;vertical-align:top}
.meta td{padding:8px 0;border-bottom:1px solid var(--rule-soft)}
.del-n{color:var(--del);font-weight:600}.ins-n{color:var(--ins);font-weight:600}
h2{font-size:21px;font-weight:700;margin:40px 0 14px}
.lede{font-size:19px;line-height:1.5;color:var(--soft);margin:0 0 24px;max-width:60ch;text-wrap:pretty}
ol.summary{margin:0 0 8px;padding-left:1.6em}
ol.summary li{margin:0 0 12px;text-wrap:pretty}
ol.summary li a{white-space:nowrap}
.legend{font-size:15px;color:var(--muted);border:1px solid var(--rule);padding:10px 14px;margin:0 0 28px}
.legend del,.legend ins{background:none}
.hunk{margin:0 0 28px;scroll-margin-top:24px;border-top:1px solid var(--rule);padding-top:10px}
.hunk:target{outline:2px solid var(--accent);outline-offset:8px}
.hh{font-size:14px;color:var(--muted);margin:0 0 10px;display:flex;flex-wrap:wrap;gap:4px 14px}
.hh b{color:var(--ink);font-weight:700}
.rl{margin:0;white-space:pre-wrap;overflow-wrap:break-word;line-height:1.7;font-size:17px}
del{color:var(--del);text-decoration:line-through;text-decoration-thickness:1.5px;background:var(--del-bg)}
ins{color:var(--ins);text-decoration:underline double;text-underline-offset:3px;background:var(--ins-bg)}
.ln{display:grid;grid-template-columns:1.4ch 1fr;gap:10px;padding:8px 12px;white-space:pre-wrap;overflow-wrap:break-word;line-height:1.6}
.ln.rm{background:var(--del-bg);color:var(--del)}
.ln.ad{background:var(--ins-bg);color:var(--ins)}
.ln+.ln{margin-top:2px}
.mk{font-weight:700;text-align:center}
.note{font-size:15px;line-height:1.5;background:var(--note);padding:12px 14px;margin:0 0 28px;border-top:2px solid var(--ink)}
.note b{display:block;font-size:14px;color:var(--muted);font-weight:600;margin-bottom:4px}
.note p{margin:0}
.note.pinned{position:sticky;top:12px}
.source{margin-top:40px;font-size:15px;color:var(--muted);border-top:1px solid var(--rule);padding-top:16px}
table.roll{border-collapse:collapse;width:100%;font-size:15px}
.roll th,.roll td{text-align:left;padding:9px 12px 9px 0;border-bottom:1px solid var(--rule-soft);vertical-align:top}
.roll th{font-weight:600;color:var(--muted);font-size:14px;border-bottom:1px solid var(--rule)}
.roll td.num{text-align:right}
.entry{border-top:1px solid var(--rule);padding:22px 0}
.entry .when{font-size:15px;color:var(--muted);margin:0 0 6px}
.entry h3{font-size:22px;margin:0 0 10px;font-weight:700;line-height:1.25}
.entry h3 a{color:var(--ink);text-decoration:none}
.entry h3 a:hover{text-decoration:underline}
.entry p{margin:0 0 8px;text-wrap:pretty}
.entry .counts{font-size:15px;color:var(--muted)}
.notice{border:1px solid var(--ink);padding:18px 22px;margin:0 0 36px}
.notice p{margin:0 0 8px}.notice p:last-child{margin:0}
@media (max-width:70em){.row{display:block}.row>.notes{position:static;max-width:66ch}.note{margin:0 0 12px}}
@media (max-width:40em){.page{padding:0 16px}h1{font-size:28px}.meta th{width:8em;padding-right:10px}.rl{font-size:16px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media print{body{background:#fff;color:#000}.masthead,.foot,.skip{display:none}.row{display:block}.hunk{break-inside:avoid}del{color:#000;background:none}ins{color:#000;background:none}.ln.rm,.ln.ad{background:#fff;color:#000}.note{background:#fff;border:1px solid #000}a{color:#000}}
"""


def e_shell(main: str, nav: str = "", latest: bool = True) -> str:
    cur = lambda k: ' aria-current="page"' if nav == k else ""
    foot = f"<span>1 change on record · latest {META['to_version']}</span>" if latest else f"<span>Watching {DOC_COUNT} documents from {len(CATALOG)} companies</span>"
    return f"""<a class="skip" href="#main">Skip to content</a>
<header class="masthead"><div class="page"><a class="brand" href="#">inplain.ai</a><nav class="nav" aria-label="Site"><a href="#"{cur("changes")}>Changes</a><a href="#"{cur("companies")}>Companies</a><a href="#">Feed</a></nav></div></header>
<main id="main"><div class="page">{main}</div></main>
<footer class="foot"><div class="page"><span>inplain.ai — what changed, why it matters, and the evidence.</span>{foot}</div></footer>"""


def e_hunk(i: int, *, inline: bool) -> str:
    h = HUNKS[i]
    if inline and SPANS[i]:
        body = f'<p class="rl">{inline_redline(i, quotes=False)}</p>'
    else:
        body = stacked_rows(i, marks=False, quotes=False)
    return f'''<section class="hunk" id="p{i + 1}" aria-label="Passage {i + 1}">
<p class="hh"><b>Passage {i + 1}</b><span>{kind(h)}</span><span>old line {120 + i * 7} · new line {121 + i * 8}</span></p>
{body}
</section>'''


def e_notes(i: int) -> str:
    out = []
    for ci in CITED.get(i, []):
        out.append(f'<aside class="note" aria-label="Claim {ci + 1}"><b>Claim {ci + 1} of {len(CLAIMS)}, on passage {i + 1}</b><p>{esc(CLAIMS[ci]["text"])}</p></aside>')
    return "".join(out)


def e_change(inline: bool = True) -> str:
    body = ""
    for i in range(len(HUNKS)):
        notes = e_notes(i)
        body += f'<div class="row">{e_hunk(i, inline=inline)}{"<div class=notes>" + notes + "</div>" if notes else ""}</div>'
    summary = "".join(
        f'<li>{esc(c["text"])} <a href="#p{list(dict.fromkeys(x["hunk"] for x in c["citations"]))[0] + 1}">See passage {list(dict.fromkeys(x["hunk"] for x in c["citations"]))[0] + 1}.</a></li>'
        for c in CLAIMS
    )
    main = f'''<article class="doc"><div class="doc-head">
<p class="caption"><a href="company.html">Google</a> · Privacy Policy · comparison detected <time datetime="{META["to_version"]}">{META["to_version"]}</time></p>
<h1>Google changed its Privacy Policy</h1>
<table class="meta"><tbody>
<tr><th scope="row">Versions compared</th><td>{META["from_version"]} against {META["to_version"]}</td></tr>
<tr><th scope="row">Passages changed</th><td>{META["hunks"]}; {META["unchanged_pct"]} of the text is unchanged</td></tr>
<tr><th scope="row">Characters</th><td><span class="ins-n">{n(META["added_chars"])} added</span>, <span class="del-n">{n(META["removed_chars"])} removed</span></td></tr>
<tr><th scope="row">Source</th><td><a href="{META["source"]}" rel="external">{META["source_host"]}</a>, linked, not republished</td></tr>
</tbody></table>
<h2>Summary of the changes</h2>
<ol class="summary">{summary}</ol>
<p>The summary covers 5 of 18 changed passages. Each claim appears again in the margin, beside the passage it cites.</p>
<h2>The changed passages, in document order</h2>
<p class="legend">Read as a redline: <del>struck text</del> was removed, <ins>double-underlined text</ins> was added. Where a passage was rewritten beyond recognition, the removed and added versions are shown in full, one after the other.</p></div>
{body}
<p class="source tail">We publish the changed passages only, never the full document. The full policy is at <a href="{META["source"]}" rel="external">{META["source_host"]}</a>.</p>
</article>'''
    return page("Google Privacy Policy — change of 2026-08-03 · inplain.ai", f"<style>{E_CSS}</style>", e_shell(main, nav="changes"))


def e_wordmarks() -> str:
    main = '<div class="doc doc-head"><h1>Word-level marks</h1><p class="lede">Passages 2 and 6, first as removed and added versions in full, then as a redline.</p>'
    for i in (1, 5):
        main += f"<h2>Passage {i + 1}, line-level only</h2>{e_hunk(i, inline=False)}<h2>Passage {i + 1}, as a redline</h2>{e_hunk(i, inline=True)}"
    return page("Word marks · E", f"<style>{E_CSS}</style>", e_shell(main + "</div>"))


def e_roll() -> str:
    rows = "".join(f'<tr><td>{esc(c["name"])}</td><td>{doc_list(c)}</td><td class="num">none yet</td></tr>' for c in COMPANIES)
    return f'<table class="roll"><thead><tr><th>Company</th><th>Documents watched</th><th class="num">Last change</th></tr></thead><tbody>{rows}</tbody></table>'


def e_home() -> str:
    main = f'''<div class="doc doc-head"><h1>The record of policy changes</h1>
<p class="lede">How the privacy policies and terms of service of well-known companies change: the changed passages, a summary that cites them, and a link to the source.</p>
<div class="notice"><p><b>No material change has been recorded yet.</b> {DOC_COUNT} documents from {len(CATALOG)} companies have been watched since {WATCH_SINCE}, once a day.</p><p>The first change appears here and in the <a href="#">Atom feed</a>. The record is not backfilled; it starts now.</p></div>
<h2>Roll of watched documents</h2>{e_roll()}</div>'''
    return page("inplain.ai — the record of policy changes", f"<style>{E_CSS}</style>", e_shell(main, latest=False))


def e_entry() -> str:
    return f'''<article class="entry">
<p class="when"><time datetime="{META["to_version"]}">{META["to_version"]}</time> · <a href="company.html">Google</a> · Privacy Policy</p>
<h3><a href="change.html">Google changed its Privacy Policy</a></h3>
<p>{esc(CLAIMS[0]["text"])} <a href="change.html">All 5 claims, with the redline.</a></p>
<p class="counts">{META["hunks"]} passages · <span class="ins-n">{n(META["added_chars"])} added</span> · <span class="del-n">{n(META["removed_chars"])} removed</span> · {META["unchanged_pct"]} unchanged</p>
</article>'''


def e_company() -> str:
    rows = "".join(
        f'<tr><td>{DOC_TITLES.get(k, k)}</td><td><a href="{u}" rel="external">{re.sub(r"^https?://", "", u).split("/")[0]}</a></td><td class="num">{META["to_version"] if k == "privacy" else "none yet"}</td></tr>'
        for k, u in sorted(GOOGLE["policy_urls"].items())
    )
    main = f'''<div class="doc doc-head"><p class="caption"><a href="#">Companies</a> · Google</p><h1>Google</h1>
<p class="lede">{len(GOOGLE["policy_urls"])} documents watched. 1 material change on record.</p>
<h2>Watched documents</h2><table class="roll"><thead><tr><th>Document</th><th>Source</th><th class="num">Last change</th></tr></thead><tbody>{rows}</tbody></table>
<h2>Changes on record</h2>{e_entry()}</div>'''
    return page("Google — tracked policies · inplain.ai", f"<style>{E_CSS}</style>", e_shell(main, nav="companies"))


def e_changes() -> str:
    main = f'''<div class="doc doc-head"><h1>All changes</h1><p class="lede">Every material change on record, newest first.</p>
<table class="roll"><thead><tr><th>Company</th><th class="num">Changes</th></tr></thead><tbody><tr><td><a href="company.html">Google</a></td><td class="num">1</td></tr></tbody></table>
<h2>Newest first</h2>{e_entry()}</div>'''
    return page("All changes · inplain.ai", f"<style>{E_CSS}</style>", e_shell(main, nav="changes"))


# =============================================================== direction F
# "Split": before and after, side by side. IBM Plex Sans, white, one link
# blue. The Summary stays in a sticky column beside the passages on wide
# screens; each replaced passage is a two-column comparison (removed left,
# added right) with word-level marks, so the eye reads across.

F_FONTS = font_face("IBM Plex Sans", [("IBM_Plex_Sans-400-normal.woff2", 400, "normal"), ("IBM_Plex_Sans-400-italic.woff2", 400, "italic"), ("IBM_Plex_Sans-600-normal.woff2", 600, "normal"), ("IBM_Plex_Sans-700-normal.woff2", 700, "normal")])
F_CSS = F_FONTS + SR + """
:root{--paper:#fff;--ink:#161616;--soft:#3c4043;--muted:#5f6368;--rule:#dadce0;--rule-soft:#eceef1;--panel:#f5f6f8;--accent:#0645ad;--focus:#0645ad;
  --add-bg:#e6f4ea;--add-ink:#0d652d;--add-line:#1e8e3e;--rm-bg:#fce8e6;--rm-ink:#a50e0e;--rm-line:#d93025}
@media (prefers-color-scheme:dark){:root{--paper:#121417;--ink:#e8eaed;--soft:#c4c7cb;--muted:#9aa0a6;--rule:#2f3439;--rule-soft:#22262b;--panel:#1a1e23;--accent:#8ab4f8;--focus:#8ab4f8;
  --add-bg:#0f2e1a;--add-ink:#8fd6a4;--add-line:#5bb974;--rm-bg:#3a1a1a;--rm-ink:#f6a19b;--rm-line:#e06666}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;background:var(--paper);color:var(--ink);font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:16px;line-height:1.55;font-variant-numeric:tabular-nums}
main{flex:1 0 auto}
a{color:var(--accent);text-underline-offset:2px}
:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
::selection{background:var(--accent);color:var(--paper)}
.skip{position:absolute;left:8px;top:8px;padding:8px 12px;background:var(--paper);border:1px solid var(--rule);transform:translateY(-200%)}
.skip:focus-visible{transform:none}
.page{max-width:1360px;margin:0 auto;padding:0 24px}
.masthead{border-bottom:1px solid var(--rule)}
.masthead .page,.foot .page{display:flex;gap:24px;align-items:baseline;padding-top:16px;padding-bottom:16px}
.brand{color:var(--ink);text-decoration:none;font-weight:700;font-size:17px}
.nav{margin-left:auto;display:flex;gap:20px;font-size:15px}
.nav a{color:var(--soft);text-decoration:none}
.nav a[aria-current],.nav a:hover{color:var(--ink);text-decoration:underline}
main .page{padding-top:36px;padding-bottom:96px}
.foot{border-top:1px solid var(--rule);font-size:14px;color:var(--muted)}
.foot .page{flex-wrap:wrap}
.head{max-width:80ch}
h1{font-size:32px;line-height:1.15;font-weight:700;letter-spacing:-.015em;margin:0 0 10px;text-wrap:balance}
.crumb{font-size:15px;color:var(--muted);margin:0 0 16px}
.crumb a{color:var(--ink)}
.strip{display:flex;flex-wrap:wrap;gap:8px 28px;font-size:15px;color:var(--muted);margin:0 0 32px;padding:12px 0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule)}
.strip b{color:var(--ink);font-weight:600}
.strip .plus{color:var(--add-ink);font-weight:600}
.strip .minus{color:var(--rm-ink);font-weight:600}
.layout{display:grid;grid-template-columns:minmax(18rem,22rem) minmax(0,1fr);gap:40px;align-items:start}
.side{position:sticky;top:16px;max-height:calc(100dvh - 32px);overflow:auto;padding-right:8px}
h2{font-size:15px;font-weight:600;margin:0 0 12px;color:var(--ink)}
.side h2{border-bottom:1px solid var(--rule);padding-bottom:8px}
ol.claims{margin:0;padding-left:1.4em}
ol.claims li{margin:0 0 14px;font-size:15px;line-height:1.5;text-wrap:pretty}
ol.claims a{display:inline-block;margin-top:2px;font-size:14px}
.side p{font-size:14px;color:var(--muted);margin:16px 0 0}
.lede{font-size:18px;line-height:1.5;color:var(--soft);margin:0 0 24px;max-width:64ch;text-wrap:pretty}
.hunk{border:1px solid var(--rule);border-radius:6px;margin:0 0 20px;overflow:hidden;scroll-margin-top:16px}
.hunk:target{border-color:var(--accent);box-shadow:0 0 0 2px var(--accent)}
.hh{display:flex;flex-wrap:wrap;gap:4px 16px;padding:8px 14px;background:var(--panel);border-bottom:1px solid var(--rule);font-size:14px;color:var(--muted)}
.hh b{color:var(--ink);font-weight:600}
.hh .cited{margin-left:auto}
.split{display:grid;grid-template-columns:1fr 1fr}
.split .col+.col{border-left:1px solid var(--rule)}
.col-h{font-size:13px;color:var(--muted);padding:6px 14px;border-bottom:1px solid var(--rule-soft);background:var(--panel)}
.ln{display:grid;grid-template-columns:1.4ch 1fr;gap:8px;padding:10px 14px;white-space:pre-wrap;overflow-wrap:break-word;font-size:15px;line-height:1.55}
.ln.rm{background:var(--rm-bg);color:var(--rm-ink)}
.ln.ad{background:var(--add-bg);color:var(--add-ink)}
.ln+.ln{border-top:1px solid var(--paper)}
.mk{font-weight:700;text-align:center}
.blank{padding:10px 14px;color:var(--muted);font-size:14px;font-style:italic}
del{text-decoration:line-through;text-decoration-color:var(--rm-line);text-decoration-thickness:1.5px;background:rgba(217,48,37,.14)}
ins{text-decoration:underline;text-decoration-color:var(--add-line);text-decoration-thickness:2px;text-underline-offset:3px;font-weight:600;background:rgba(30,142,62,.14)}
.legend{font-size:14px;color:var(--muted);margin:0 0 16px}
.source{margin-top:32px;font-size:15px;color:var(--muted)}
.board{display:grid;grid-template-columns:repeat(3,1fr);gap:0 32px;list-style:none;margin:0;padding:0}
.board li{padding:10px 0;border-bottom:1px solid var(--rule-soft);font-size:15px}
.board b{font-weight:600;display:block}
.board span{color:var(--muted);font-size:14px}
table{border-collapse:collapse;width:100%;font-size:15px;max-width:80ch}
th,td{text-align:left;padding:10px 12px 10px 0;border-bottom:1px solid var(--rule);vertical-align:top}
th{font-weight:600;color:var(--muted);font-size:14px}
td.num{text-align:right}
.entry{border:1px solid var(--rule);border-radius:6px;padding:18px 20px;max-width:80ch;margin:0 0 16px}
.entry .when{font-size:14px;color:var(--muted);margin:0 0 6px}
.entry h3{font-size:20px;margin:0 0 8px;font-weight:600;line-height:1.3}
.entry h3 a{color:var(--ink);text-decoration:none}
.entry h3 a:hover{text-decoration:underline}
.entry p{margin:0 0 8px;text-wrap:pretty}
.entry .counts{font-size:14px;color:var(--muted);margin:0}
.status{background:var(--panel);border:1px solid var(--rule);border-radius:6px;padding:16px 20px;margin:0 0 32px;max-width:80ch}
.status p{margin:0 0 6px}.status p:last-child{margin:0}
.section-h{font-size:20px;font-weight:600;margin:40px 0 12px}
@media (max-width:64em){.layout{display:block}.side{position:static;max-height:none;margin-bottom:28px;padding:0}.split{grid-template-columns:1fr}.split .col+.col{border-left:0;border-top:1px solid var(--rule)}.board{grid-template-columns:1fr 1fr}}
@media (max-width:40em){.page{padding:0 16px}h1{font-size:26px}.board{grid-template-columns:1fr}.ln{padding:8px 10px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media print{body{background:#fff;color:#000}.masthead,.foot,.skip{display:none}.layout{display:block}.side{position:static}.hunk{break-inside:avoid;border-color:#000}.ln.rm,.ln.ad{background:#fff;color:#000}.hh,.col-h{background:#fff}a{color:#000}}
"""


def f_shell(main: str, nav: str = "", latest: bool = True) -> str:
    cur = lambda k: ' aria-current="page"' if nav == k else ""
    foot = f"<span>1 change on record · latest {META['to_version']}</span>" if latest else f"<span>Watching {DOC_COUNT} documents from {len(CATALOG)} companies</span>"
    return f"""<a class="skip" href="#main">Skip to content</a>
<header class="masthead"><div class="page"><a class="brand" href="#">inplain.ai</a><nav class="nav" aria-label="Site"><a href="#"{cur("changes")}>Changes</a><a href="#"{cur("companies")}>Companies</a><a href="#">Feed</a></nav></div></header>
<main id="main"><div class="page">{main}</div></main>
<footer class="foot"><div class="page"><span>inplain.ai — what changed, why it matters, and the evidence.</span>{foot}</div></footer>"""


def f_side_rows(i: int, side: str, marks: bool) -> str:
    h = HUNKS[i]
    cls, mk, label = ("rm", "−", "Removed:") if side == "removed" else ("ad", "+", "Added:")
    if not h[side]:
        return '<p class="blank">nothing on this side</p>'
    return "\n".join(
        f'<div class="ln {cls}"><span class="mk" aria-hidden="true">{mk}</span><span class="sr">{label}</span> <span class="tx">{mark_text(line, line_spans(i, side, li, line, marks, False))}</span></div>'
        for li, line in enumerate(h[side])
    )


def f_hunk(i: int, *, marks: bool) -> str:
    h = HUNKS[i]
    cited = CITED.get(i, [])
    cited_html = f'<span class="cited">cited by claim {", ".join(str(c + 1) for c in cited)}</span>' if cited else ""
    return f'''<section class="hunk" id="p{i + 1}" aria-label="Passage {i + 1}">
<div class="hh"><span><b>Passage {i + 1}</b> of {META["hunks"]}</span><span>{kind(h)}</span><span>old line {120 + i * 7} · new line {121 + i * 8}</span>{cited_html}</div>
<div class="split">
<div class="col"><div class="col-h">Before ({META["from_version"]})</div>{f_side_rows(i, "removed", marks)}</div>
<div class="col"><div class="col-h">After ({META["to_version"]})</div>{f_side_rows(i, "added", marks)}</div>
</div></section>'''


def f_change(marks: bool = True) -> str:
    claims = "".join(
        f'<li>{esc(c["text"])}<br><a href="#p{list(dict.fromkeys(x["hunk"] for x in c["citations"]))[0] + 1}">Passage {list(dict.fromkeys(x["hunk"] for x in c["citations"]))[0] + 1}</a></li>'
        for c in CLAIMS
    )
    main = f'''<div class="head">
<p class="crumb"><a href="company.html">Google</a> · Privacy Policy · detected <time datetime="{META["to_version"]}">{META["to_version"]}</time></p>
<h1>Google changed its Privacy Policy</h1>
<p class="strip"><span><b>{META["from_version"]}</b> compared with <b>{META["to_version"]}</b></span><span><b>{META["hunks"]}</b> passages changed</span><span><span class="plus">+{n(META["added_chars"])}</span> / <span class="minus">−{n(META["removed_chars"])}</span> characters</span><span><b>{META["unchanged_pct"]}</b> unchanged</span><span>Source: <a href="{META["source"]}" rel="external">{META["source_host"]}</a></span></p>
</div>
<div class="layout">
<aside class="side"><h2>What changed</h2><ol class="claims">{claims}</ol><p>5 of 18 passages are covered by a claim. Every quote in a claim was checked against the passage it names.</p></aside>
<div>
<p class="legend">Before on the left, after on the right. Struck words were removed, underlined words were added.</p>
{"".join(f_hunk(i, marks=marks) for i in range(len(HUNKS)))}
<p class="source">We publish the changed passages only, never the full document. The full policy is at <a href="{META["source"]}" rel="external">{META["source_host"]}</a>.</p>
</div></div>'''
    return page("Google Privacy Policy — change of 2026-08-03 · inplain.ai", f"<style>{F_CSS}</style>", f_shell(main, nav="changes"))


def f_wordmarks() -> str:
    main = '<div class="head"><h1>Word-level marks</h1><p class="lede">Passages 2 and 6, first with line-level marks only, then with word-level marks.</p></div>'
    for i in (1, 5):
        main += f'<p class="section-h">Passage {i + 1}, line-level only</p>{f_hunk(i, marks=False)}<p class="section-h">Passage {i + 1}, with word-level marks</p>{f_hunk(i, marks=True)}'
    return page("Word marks · F", f"<style>{F_CSS}</style>", f_shell(main))


def f_home() -> str:
    board = "".join(f'<li><b>{esc(c["name"])}</b><span>{doc_list(c)}</span></li>' for c in COMPANIES)
    main = f'''<div class="head"><h1>No policy has changed yet.</h1>
<p class="lede">inplain.ai keeps a public record of how the privacy policies and terms of service of well-known companies change: the changed passages, a summary that cites them, and a link to the source.</p></div>
<div class="status"><p><b>0</b> changes on record · <b>{len(CATALOG)}</b> companies · <b>{DOC_COUNT}</b> documents · watched daily since <b>{WATCH_SINCE}</b></p><p>The first material change appears here and in the <a href="#">Atom feed</a>. Nothing is backfilled.</p></div>
<p class="section-h">Watched documents</p>
<ul class="board">{board}</ul>'''
    return page("inplain.ai — the record of policy changes", f"<style>{F_CSS}</style>", f_shell(main, latest=False))


def f_entry() -> str:
    return f'''<article class="entry">
<p class="when"><time datetime="{META["to_version"]}">{META["to_version"]}</time> · <a href="company.html">Google</a> · Privacy Policy</p>
<h3><a href="change.html">Google changed its Privacy Policy</a></h3>
<p>{esc(CLAIMS[0]["text"])} <a href="change.html">All 5 claims, before and after.</a></p>
<p class="counts">{META["hunks"]} passages · <span class="plus">+{n(META["added_chars"])}</span> / <span class="minus">−{n(META["removed_chars"])}</span> characters · {META["unchanged_pct"]} unchanged</p>
</article>'''


def f_company() -> str:
    rows = "".join(
        f'<tr><td>{DOC_TITLES.get(k, k)}</td><td><a href="{u}" rel="external">{re.sub(r"^https?://", "", u).split("/")[0]}</a></td><td class="num">{META["to_version"] if k == "privacy" else "none yet"}</td></tr>'
        for k, u in sorted(GOOGLE["policy_urls"].items())
    )
    main = f'''<div class="head"><p class="crumb"><a href="#">Companies</a> · Google</p><h1>Google</h1>
<p class="lede">{len(GOOGLE["policy_urls"])} documents watched. 1 material change on record.</p></div>
<p class="section-h">Watched documents</p><table><thead><tr><th>Document</th><th>Source</th><th class="num">Last change</th></tr></thead><tbody>{rows}</tbody></table>
<p class="section-h">Changes on record</p>{f_entry()}'''
    return page("Google — tracked policies · inplain.ai", f"<style>{F_CSS}</style>", f_shell(main, nav="companies"))


def f_changes() -> str:
    main = f'''<div class="head"><h1>All changes</h1><p class="lede">Every material change on record, newest first. 1 change from 1 company.</p></div>
<table><thead><tr><th>Company</th><th class="num">Changes</th></tr></thead><tbody><tr><td><a href="company.html">Google</a></td><td class="num">1</td></tr></tbody></table>
<p class="section-h">Newest first</p>{f_entry()}'''
    return page("All changes · inplain.ai", f"<style>{F_CSS}</style>", f_shell(main, nav="changes"))


# --------------------------------------------------------------------- main

DIRECTIONS = {
    "a": {"name": "A · reference instrument (incumbent)", "change": a_change, "wordmarks": a_wordmarks, "home": a_home, "company": a_company, "changes": a_changes},
    "d": {"name": "D · register", "change": d_change, "wordmarks": d_wordmarks, "home": d_home, "company": d_company, "changes": d_changes},
    "e": {"name": "E · redline", "change": e_change, "wordmarks": e_wordmarks, "home": e_home, "company": e_company, "changes": e_changes},
    "f": {"name": "F · split", "change": f_change, "wordmarks": f_wordmarks, "home": f_home, "company": f_company, "changes": f_changes},
}


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    index = ["<!doctype html><meta charset=utf-8><title>#37 prototypes</title><body style='font:16px/1.5 system-ui;padding:2rem'><h1>#37 design directions</h1>"]
    for slug, d in DIRECTIONS.items():
        (OUT / slug).mkdir()
        index.append(f"<h2>{esc(d['name'])}</h2><ul>")
        for pg in ("change", "wordmarks", "home", "company", "changes"):
            (OUT / slug / f"{pg}.html").write_text(d[pg](), encoding="utf-8")
            index.append(f'<li><a href="{slug}/{pg}.html">{pg}</a></li>')
        index.append("</ul>")
    (OUT / "index.html").write_text("".join(index), encoding="utf-8")
    spans = sum(1 for s in SPANS.values() if s)
    print(f"wrote {len(DIRECTIONS) * 5} pages to {OUT.relative_to(ROOT.parent)}; word spans computed for {spans} of {len(HUNKS)} hunks")


if __name__ == "__main__":
    main()
