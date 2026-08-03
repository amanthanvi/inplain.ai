"""Render the same real policy diff in three design directions.

Input is a genuine change: Google's privacy policy, first-party archived
version 2026-04-02 versus current. 18 hunks, 0.936 similarity. Nothing here
is mocked - if a direction looks good on this data it will look good in
production, and if it falls apart on a 7,660-character change it would have
fallen apart later.

Usage: python prototypes/build.py
"""

from __future__ import annotations

import html
import json
import pathlib

ROOT = pathlib.Path(__file__).parent
HUNKS = json.loads((ROOT / "sample-hunks.json").read_text())

META = {
    "company": "Google",
    "doc": "Privacy Policy",
    "from_version": "2026-04-02",
    "to_version": "2026-08-03",
    "source": "https://policies.google.com/privacy",
    "added_chars": sum(len("".join(h["added"])) for h in HUNKS),
    "removed_chars": sum(len("".join(h["removed"])) for h in HUNKS),
    "hunks": len(HUNKS),
}

# Hand-written from the real diff, in the shape the summarizer will emit.
SUMMARY = [
    {
        "text": "Google broadened what it collects from your interactions: the "
        "category that was “Voice and audio information” is now “Media (like "
        "images, files, audio and video) from your interactions”.",
        "citations": [{"hunk": 3, "side": "added"}],
    },
    {
        "text": "A new sentence states plainly that Google collects and uses "
        "data not associated with your account, where the previous wording "
        "only described what happens when you are signed out.",
        "citations": [{"hunk": 2, "side": "added"}],
    },
    {
        "text": "Activity you can find and manage is now described as saved "
        "“in your history” rather than “by your activity controls”.",
        "citations": [{"hunk": 4, "side": "added"}],
    },
]


def esc(s: str) -> str:
    return html.escape(s, quote=False)


def hunk_rows(h: dict) -> str:
    """One hunk as removed lines then added lines, both labelled."""
    out = []
    for line in h["removed"]:
        out.append(
            f'<div class="ln rm"><span class="mk" aria-hidden="true">−</span>'
            f'<span class="sr">Removed:</span> <span class="tx">{esc(line)}</span></div>'
        )
    for line in h["added"]:
        out.append(
            f'<div class="ln ad"><span class="mk" aria-hidden="true">+</span>'
            f'<span class="sr">Added:</span> <span class="tx">{esc(line)}</span></div>'
        )
    return "\n".join(out)


def summary_html(accent_class: str = "cit") -> str:
    items = []
    for b in SUMMARY:
        marks = "".join(
            f'<a class="{accent_class}" href="#h{c["hunk"]}" '
            f'title="Jump to the changed passage">[H{c["hunk"]}]</a>'
            for c in b["citations"]
        )
        items.append(f"<li>{esc(b['text'])} {marks}</li>")
    return "\n".join(items)


def hunks_html(limit: int | None = None) -> str:
    out = []
    for i, h in enumerate(HUNKS if limit is None else HUNKS[:limit]):
        out.append(
            f'<section class="hunk" id="h{i}">'
            f'<div class="hh"><span class="hid">H{i}</span>'
            f'<span class="hkind">{h["tag"]}</span></div>'
            f'<div class="hb">{hunk_rows(h)}</div>'
            f"</section>"
        )
    return "\n".join(out)


BASE_RESET = """
*,*::before,*::after{box-sizing:border-box}
body{margin:0}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
a{color:inherit}
"""


def page(title: str, css: str, body: str) -> str:
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>{BASE_RESET}{css}</style>
</head><body>{body}</body></html>"""


# ---------------------------------------------------------------- direction A
# "Court docket" - the reference instrument the salvage plan argued for.
# Near-monochrome, serif prose, monospace diff with a gutter, accent reserved
# entirely for citations.

CSS_A = """
:root{
  --paper:#fbfbf9; --ink:#16171a; --soft:#3b3d42; --muted:#5c5f66; --rule:#e3e3df;
  --accent:#0b5cd5; --add:#e6f4ea; --add-ink:#0b6b2f; --rm:#fdeaea; --rm-ink:#9b1c1c;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --text:Charter,"Iowan Old Style","Source Serif 4",Georgia,serif;
}
@media (prefers-color-scheme:dark){:root{
  --paper:#101114; --ink:#e9e9ea; --soft:#c6c8cd; --muted:#9a9da5; --rule:#26282e;
  --accent:#6aa9ff; --add:#13301d; --add-ink:#7fd39b; --rm:#3a1618; --rm-ink:#f2a3a3;}}
body{background:var(--paper);color:var(--ink);font-family:var(--text);
  font-size:17px;line-height:1.62;-webkit-font-smoothing:antialiased}
.wrap{max-width:78ch;margin:0 auto;padding:56px 24px 96px}

/* header - the one place with a little more life */
.kicker{display:flex;align-items:center;gap:9px;font-family:var(--mono);font-size:11.5px;
  letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin-bottom:18px}
.kicker .co{color:var(--ink);font-weight:700}
.kicker .tick{width:16px;height:2px;background:var(--accent);border-radius:1px;flex:0 0 auto}
h1{font-size:30px;line-height:1.22;margin:0 0 14px;font-weight:600;letter-spacing:-.014em;
  max-width:26ch}
.lede{color:var(--soft);font-size:17.5px;line-height:1.55;margin:0 0 26px;max-width:60ch}
.meta{display:flex;gap:20px;flex-wrap:wrap;font-family:var(--mono);font-size:12.5px;
  color:var(--muted);border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);
  padding:13px 0;margin-bottom:36px;align-items:baseline}
.meta .n{font-weight:700}
.meta .plus .n{color:var(--add-ink)}
.meta .minus .n{color:var(--rm-ink)}
.meta .span{margin-left:auto;color:var(--muted)}

h2{font-size:13px;font-family:var(--mono);letter-spacing:.09em;text-transform:uppercase;
  color:var(--muted);font-weight:600;margin:38px 0 14px}
ul.sum{margin:0;padding-left:20px}
ul.sum li{margin-bottom:14px}
.cit{font-family:var(--mono);font-size:12px;color:var(--accent);text-decoration:none;
  border-bottom:1px solid currentColor;padding-bottom:1px;white-space:nowrap}
.cit:hover{background:var(--accent);color:var(--paper)}
.cit:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.hunk{border:1px solid var(--rule);border-radius:3px;margin-bottom:14px;overflow:hidden}
.hunk:target{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 22%,transparent)}
.hh{display:flex;gap:10px;align-items:center;background:color-mix(in srgb,var(--ink) 4%,transparent);
  border-bottom:1px solid var(--rule);padding:6px 12px;font-family:var(--mono);font-size:11px;
  letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.hid{font-weight:700;color:var(--ink)}
.hb{font-family:var(--mono);font-size:13.5px;line-height:1.65}
.ln{display:flex;gap:10px;padding:3px 12px;white-space:pre-wrap;word-break:normal;
  overflow-wrap:break-word}
.ln.rm{background:var(--rm);color:var(--rm-ink)}
.ln.ad{background:var(--add);color:var(--add-ink)}
.mk{flex:0 0 1ch;font-weight:700;opacity:.75}
.tx{flex:1;min-width:0}
.src{margin-top:34px;font-size:14px;color:var(--muted)}
.src a{color:var(--accent)}
@media (max-width:640px){h1{font-size:25px}.lede{font-size:16.5px}.meta .span{margin-left:0;width:100%}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media print{.hunk{break-inside:avoid}body{background:#fff;color:#000}}
"""

BODY_A = f"""<div class="wrap">
<div class="kicker"><span class="tick"></span><span class="co">{META["company"]}</span>
  <span>· {META["doc"]}</span></div>
<h1>Google widened what counts as your &ldquo;media&rdquo;</h1>
<p class="lede">One collected category grew from voice and audio to images, files,
audio and video &mdash; and a new sentence says outright that Google collects data
not tied to your account.</p>
<div class="meta">
  <span class="plus"><span class="n">+{META["added_chars"]:,}</span> added</span>
  <span class="minus"><span class="n">&minus;{META["removed_chars"]:,}</span> removed</span>
  <span><span class="n">{META["hunks"]}</span> passages</span>
  <span class="span">{META["from_version"]} &rarr; {META["to_version"]}</span>
</div>
<h2>What changed</h2>
<ul class="sum">{summary_html()}</ul>
<h2>The changed passages</h2>
{hunks_html(6)}
<p class="src">Showing 6 of 18. Full policy at
<a href="{META["source"]}">policies.google.com/privacy</a> &mdash; we link, we don't republish.</p>
</div>"""


# ---------------------------------------------------------------- direction B
# "Terminal / commit log" - treats a policy change as a commit. Mono
# throughout, dense, high information density, developer-adjacent.

CSS_B = """
:root{
  --bg:#0d1117; --fg:#d4d7dd; --dim:#7d8590; --rule:#21262d; --panel:#141a21;
  --accent:#e3b341; --add-ink:#57d38c; --rm-ink:#f4736c;
  --add-bg:#0e2a1a; --rm-bg:#2d1416;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:light){:root{
  --bg:#fff; --fg:#1f2328; --dim:#636c76; --rule:#d1d9e0; --panel:#f6f8fa;
  --accent:#9a6700; --add-ink:#116329; --rm-ink:#a40e26;
  --add-bg:#e6ffec; --rm-bg:#ffebe9;}}
body{background:var(--bg);color:var(--fg);font-family:var(--mono);
  font-size:13.5px;line-height:1.6}
.wrap{max-width:1000px;margin:0 auto;padding:34px 20px 90px}
.commit{border:1px solid var(--rule);border-radius:6px;overflow:hidden;margin-bottom:22px}
.chead{background:var(--panel);border-bottom:1px solid var(--rule);padding:14px 16px}
.cid{color:var(--accent);font-weight:700}
.ctitle{color:var(--fg);font-size:15px;margin:8px 0 0;font-weight:600}
.cmeta{color:var(--dim);font-size:12px;margin-top:8px;display:flex;gap:18px;flex-wrap:wrap}
.stat .p{color:var(--add-ink)} .stat .m{color:var(--rm-ink)}
.body{padding:16px}
.lbl{color:var(--dim);font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin:0 0 10px}
ul.sum{margin:0 0 4px;padding-left:18px}
ul.sum li{margin-bottom:10px;color:var(--fg)}
.cit{color:var(--accent);text-decoration:none;border-bottom:1px dashed currentColor}
.cit:hover{background:var(--accent);color:var(--bg);border-color:transparent}
.cit:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.hunk{border:1px solid var(--rule);border-radius:6px;margin-bottom:10px;overflow:hidden}
.hunk:target{border-color:var(--accent)}
.hh{display:flex;gap:10px;background:var(--panel);border-bottom:1px solid var(--rule);
  padding:5px 12px;font-size:11px;color:var(--dim)}
.hid{color:var(--accent);font-weight:700}
.ln{display:flex;gap:8px;padding:2px 12px;white-space:pre-wrap;overflow-wrap:break-word}
.ln.rm{background:var(--rm-bg);color:var(--rm-ink)}
.ln.ad{background:var(--add-bg);color:var(--add-ink)}
.mk{flex:0 0 1ch;font-weight:700}
.tx{flex:1;min-width:0}
.foot{color:var(--dim);font-size:12px;margin-top:20px}
.foot a{color:var(--accent)}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
"""

BODY_B = f"""<div class="wrap">
<div class="commit">
  <div class="chead">
    <div><span class="cid">change 4f2a1c9</span>
      <span style="color:var(--dim)"> · {META["company"].lower()}/privacy-policy</span></div>
    <p class="ctitle">Broaden collected media category; state non-account data collection explicitly</p>
    <div class="cmeta">
      <span>{META["from_version"]} → {META["to_version"]}</span>
      <span class="stat"><span class="p">+{META["added_chars"]:,}</span>
        <span class="m">−{META["removed_chars"]:,}</span></span>
      <span>{META["hunks"]} hunks</span>
    </div>
  </div>
  <div class="body">
    <p class="lbl">Summary</p>
    <ul class="sum">{summary_html()}</ul>
  </div>
</div>
<p class="lbl">Diff</p>
{hunks_html(6)}
<p class="foot">6 of 18 hunks shown · source:
<a href="{META["source"]}">policies.google.com/privacy</a></p>
</div>"""


# ---------------------------------------------------------------- direction C
# "Editorial" - the change presented as a story with the evidence beneath.
# Larger type, more air, strongest for a reader who is not technical.

CSS_C = """
:root{
  --bg:#faf9f7; --ink:#1a1a1a; --muted:#6b6b6b; --rule:#e5e2dd;
  --accent:#b3261e; --add-bg:#eef6f0; --add-ink:#1e5c37; --rm-bg:#faeeee; --rm-ink:#8c2a26;
  --sans:"Inter",system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root{
  --bg:#141312; --ink:#ededea; --muted:#9d9a95; --rule:#2b2926;
  --accent:#ff8a80; --add-bg:#14291d; --add-ink:#87cfa2; --rm-bg:#2f1a19; --rm-ink:#f0a6a2;}}
body{background:var(--bg);color:var(--ink);font-family:var(--sans);
  font-size:18px;line-height:1.7;-webkit-font-smoothing:antialiased}
.wrap{max-width:70ch;margin:0 auto;padding:70px 24px 110px}
.kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);
  font-weight:700;margin-bottom:16px}
h1{font-size:40px;line-height:1.14;letter-spacing:-.022em;margin:0 0 18px;font-weight:700}
.lede{font-size:20px;line-height:1.55;color:var(--muted);margin:0 0 30px}
.rule{height:1px;background:var(--rule);margin:34px 0}
.facts{display:flex;gap:28px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.facts b{color:var(--ink);font-weight:600}
h2{font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
  margin:40px 0 16px;font-weight:700}
ul.sum{margin:0;padding-left:22px}
ul.sum li{margin-bottom:18px}
.cit{font-family:var(--mono);font-size:12px;color:var(--accent);text-decoration:none;
  font-weight:600;border-bottom:2px solid color-mix(in srgb,var(--accent) 35%,transparent)}
.cit:hover{border-bottom-color:var(--accent)}
.cit:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.hunk{margin-bottom:18px;border-left:3px solid var(--rule);padding-left:18px}
.hunk:target{border-left-color:var(--accent)}
.hh{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--muted);margin-bottom:8px;display:flex;gap:10px}
.hid{color:var(--accent);font-weight:700}
.hb{font-family:var(--mono);font-size:13.5px;line-height:1.62;border-radius:4px;overflow:hidden}
.ln{display:flex;gap:10px;padding:4px 12px;white-space:pre-wrap;overflow-wrap:break-word}
.ln.rm{background:var(--rm-bg);color:var(--rm-ink)}
.ln.ad{background:var(--add-bg);color:var(--add-ink)}
.mk{flex:0 0 1ch;font-weight:700;opacity:.8}
.tx{flex:1;min-width:0}
.src{margin-top:38px;font-size:15px;color:var(--muted)}
.src a{color:var(--accent);font-weight:600}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
"""

BODY_C = f"""<div class="wrap">
<div class="kicker">{META["company"]} · {META["doc"]}</div>
<h1>Google widened what counts as your “media”, and said the quiet part out loud</h1>
<p class="lede">Between {META["from_version"]} and {META["to_version"]}, one collected
category grew from voice and audio to images, files, audio and video — and a new
sentence states that Google collects data not tied to your account at all.</p>
<div class="rule"></div>
<div class="facts">
  <span><b>{META["hunks"]}</b> passages changed</span>
  <span><b>+{META["added_chars"]:,}</b> added</span>
  <span><b>−{META["removed_chars"]:,}</b> removed</span>
  <span><b>93.6%</b> unchanged</span>
</div>
<h2>What changed</h2>
<ul class="sum">{summary_html()}</ul>
<h2>The evidence</h2>
{hunks_html(6)}
<p class="src">6 of 18 passages shown. We link to the source rather than republish it —
read the full policy at <a href="{META["source"]}">policies.google.com/privacy</a>.</p>
</div>"""


def main() -> None:
    for name, title, css, body in [
        ("a-docket", "A · Reference instrument", CSS_A, BODY_A),
        ("b-commit", "B · Commit log", CSS_B, BODY_B),
        ("c-editorial", "C · Editorial", CSS_C, BODY_C),
    ]:
        out = ROOT / f"{name}.html"
        out.write_text(page(title, css, body))
        print(f"wrote {out.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
