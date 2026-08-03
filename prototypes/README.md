# Design prototypes

> **Chosen: A — reference instrument**, with the header lifted partway toward C.
> B and C are kept for the record, not for use.

Three directions for the change view — the surface that matters, because it is
where design and product logic are the same decision.

**All three render the same real diff.** Nothing here is mocked: it is Google's
privacy policy, first-party archived version `2026-04-02` against the version
live on `2026-08-03`, extracted with trafilatura exactly as the pipeline will.
18 hunks, 0.936 similarity, +7,660 / −6,444 characters.

That matters. A design that looks good on three tidy invented hunks tells you
nothing; this change includes a 900-character replaced paragraph and a
seven-word one, which is what the real distribution looks like.

The change itself is genuinely substantive — Google broadened a collected
category from "Voice and audio information" to "Media (like images, files, audio
and video) from your interactions", and added a sentence stating outright that
it collects data not associated with your account.

## The directions

| | Character | Comparables |
|---|---|---|
| **A** `a-docket.html` ✅ | Reference instrument. Serif prose, monospace diff, near-monochrome, accent reserved *entirely* for citations. Header carries a claim-making headline and colour-coded stats. | A court docket, a well-set legal document |
| **B** `b-commit.html` | The change as a commit. Mono throughout, dense, high information density, dark-first. | `git log`, a GitHub commit view |
| **C** `c-editorial.html` | The change as a story, evidence beneath. Larger type, more air, a headline that makes a claim. | A newsroom explainer |

## Regenerate

```bash
python prototypes/build.py
```

Reads `sample-hunks.json` and writes the three HTML files. Open them directly —
no server, no build step, no dependencies.

## The header, specifically

A's body is deliberately quiet; the header is the one place with more life. It
carries an accent tick, the company set in ink against a muted document type, a
headline that makes a claim rather than naming the document, a one-sentence lede,
and colour-coded totals — added in green, removed in red.

That colour does **not** break A's rule that the accent belongs to citations
alone. Diff green and red are a separate semantic channel from the citation
accent, so using them for the totals reinforces the mapping rather than diluting
it. All four colours were measured against both themes before use:

| | on light | on dark |
|---|---|---|
| added | 6.42:1 | 10.51:1 |
| removed | 7.87:1 | 9.48:1 |
| citation accent | 5.78:1 | 7.85:1 |

## What they share

Deliberately identical across all three, because these are the SPEC §9 floor and
not stylistic choices:

- `+`/`−` gutter marks **and** visually-hidden "Added:"/"Removed:" labels, so the
  diff never depends on colour alone
- `:focus-visible` outlines on citations
- `prefers-color-scheme` light and dark, designed rather than swapped
- `prefers-reduced-motion`
- No word-breaking mid-token in the diff body
- Citations jump to the hunk they name, and the target is highlighted

## Known gaps

These are prototypes of a *view*, not the site. Not covered yet: the change
index, per-company pages, the homepage feed, mobile at narrow widths, and
word-level intra-line highlighting (SPEC §11 — it needs a backend contract
first).
