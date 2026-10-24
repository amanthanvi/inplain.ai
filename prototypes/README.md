# Design prototypes (#37)

> **Chosen 2026-09-27, confirmed by the owner 2026-10-24: D — register.** Literata for everything,
> white paper, each Claim followed by the passage it cites with the quoted
> words highlighted, word-level marks inside replaced passages. A, E and F are
> kept as screenshots for the record. Decision, scores and rationale are on
> [#37](https://github.com/amanthanvi/inplain.ai/issues/37).

Throwaway pages that rendered the same real data in every direction, so the
decision was made on the thing itself rather than on tidy invented examples.
With D built into the site (#39) and confirmed, the generator
(`build.py`) and its copy of the fonts are deleted; both stay in git
history. What remains is the record: this file, the screenshots, and the
sample data, which `tests/test_detect.py` still reads.

**The data.** `sample-hunks.json` is Google's privacy policy, first-party
archived version 2026-04-02 against the version live on 2026-08-03,
extracted exactly as the pipeline does: 18 Hunks, including replaced
paragraphs of roughly 550 to 1,000 characters that differ by a handful of
words. The
Summary in `build.py` was hand-written in the shape `summarize.py` emits, and
every Citation was checked against its Side before a page was written, the way
the product checks them. The homepage is rendered in its empty state, which
is the launch state; the Company page and the Change record index carry the
one record.

## The directions

| | World | Typeface | Structure |
|---|---|---|---|
| **A** | Reference instrument, the 2025 incumbent (real templates and stylesheets) | Charter, falling back to Times | Summary list, then all passages in order; `[H4]` citation tags |
| **D** ✅ | A civil register: white paper, black ink, one teal accent | Literata (OFL, self-hosted woff2) | Each Claim followed by the passage it cites, quoted words highlighted; the uncited passages follow in document order |
| **E** | A lawyer's redline: the change as a comparison document | Source Serif 4 | Passages in document order; a replaced paragraph is one merged redline (struck removals, double-underlined additions); Claims repeat as margin notes beside the passage they cite |
| **F** | Before and after, side by side | IBM Plex Sans | Sticky Claim rail; each passage is a two-column comparison with word marks |

Shared by all four, because they are the SPEC §9 floor and not choices:
`+`/`−` gutter marks and visually hidden Added:/Removed: labels on every
changed line; light and dark designed separately; reduced motion; print;
no JavaScript.

## Screenshots

The screenshots under `screenshots/` were taken with Playwright driving
Chrome at 1280px and 390px, light and dark, from the generated pages. They
are the record the blind panel judged.

## Word-level marks

`build.py` also contained the candidate build-time computation for word-level
marks (`word_spans`): a token diff of a Hunk's removed text against its
added text, expressed as character offsets in G1's reserved shape, applied
only when the two sides align (similarity 0.5 or better). Marks are
presentation; Citations keep validating against whole lines on their Side.
`wordmarks.html` in each direction showed passages 2 and 6 without and with
them. The shipped version lives in `inplain/site.py` (`word_spans`). This fed [#38](https://github.com/amanthanvi/inplain.ai/issues/38).
