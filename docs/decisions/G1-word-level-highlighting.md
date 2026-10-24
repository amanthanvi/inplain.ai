# G1 — Word-level intra-line highlighting does not ship in v1

> **Superseded on 2026-09-27** by the decision on
> [#38](https://github.com/amanthanvi/inplain.ai/issues/38), made by the lead
> under the owner's delegation and provisional until the cutover: word-level
> marks **do** ship at launch, computed at build time in `inplain/site.py`
> and never stored. Everything below about the schema still holds:
> `word_spans` stays `null` at `schema_version` 1, published records are
> immutable, and Citations quote and validate against whole lines on their
> Side. Only resolution item 1 changes; the rationale below is historical.

**Decided:** 2026-08-19, by the owner. Resolves
[#28](https://github.com/amanthanvi/inplain.ai/issues/28).

## Resolution

1. **v1 ships line-level marks only.** A replaced paragraph renders as the whole
   removed block and the whole added block, with `+`/`−` gutter marks and
   visually-hidden "Added:"/"Removed:" labels per the SPEC §9 floor.
2. **The hunk schema reserves word-level spans** so they can be added later
   without a format change. See the normative schema below.
3. **Citations always quote the plain line text**, never marked-up text. This
   holds even after word-level spans ship: spans are presentation metadata,
   the line is the evidence. T3's side-aware validation therefore never
   interacts with highlighting.

## Why deferred, not shipped or killed

- A wrong intra-line highlight draws the eye to the wrong clause in a tool
  whose entire proposition is that you can trust what it points at. Word-level
  alignment inside a replaced paragraph is a second diff with its own failure
  modes, in the one place correctness matters most.
- The raw material (separate added/removed text per hunk) is preserved by the
  schema, so shipping it later is additive: compute spans, populate a field
  that is `null` today, and add the rendering. Nothing downstream re-formats.
- Killed outright would forbid the salvage triage's observation that this
  "raises the tool's value more than any amount of styling". The door stays
  open at the cost of two reserved fields.

## Normative change-record schema (v1)

This is the contract T2 produces, T3 extends, and T4/T5 consume.
`inplain/schema.py` is the executable form; this document is the rationale.

```jsonc
// changes/<id>.json
{
  "schema_version": 1,
  // Stable once published (T5 depends on this). Derived from the immutable
  // document commit: "<company>-<doc>-<shortsha7>".
  "id": "google-privacy-a1b2c3d",
  "company": "google",              // catalog slug
  "company_name": "Google",
  "doc": "privacy",                 // key within catalog policy_urls
  "source_url": "https://…",
  "commit": "<full sha of the document commit>",
  "parent_commit": "<full sha of the previous snapshot commit>",
  "detected_at": "2026-08-19T00:00:00Z",
  "materiality": {
    "material": true,               // false ⇒ suppressed, never published
    "reason": "added_prose_exceeds_sentence_threshold",  // ALWAYS recorded
    "added_chars": 1234,            // absolute changed content — the gate
    "removed_chars": 56,
    "similarity_badge": 0.98,       // display only, never a gate
    "effective_date_change": null   // or {"from": "…", "to": "…"}; one side may be null (date added or removed outright)
  },
  "hunks": [
    {
      "id": "h1",                   // stable within the record; anchor target
      "old_start": 120,             // 1-based line numbers in each version
      "new_start": 121,
      "context_before": ["…"],      // up to 3 lines
      "removed": ["…"],             // strictly separate from added — T3's
      "added": ["…"],               //   side-aware validation depends on it
      "context_after": ["…"],
      // RESERVED for word-level marks; always null in v1. When populated:
      // {"removed": [[lineIndex, [[start, end], …]], …],
      //  "added":   [[lineIndex, [[start, end], …]], …]}
      // where [start, end) are character offsets into the plain line text.
      "word_spans": null
    }
  ],
  // Added by T3; absent until then. Every citation validates against the
  // named side of the named hunk, exact or whitespace/case-tolerant only.
  "summary": {
    "model": "…",
    "generated_at": "…",
    "coverage": {"covered_hunks": 18, "total_hunks": 18},  // partial coverage is recorded
    "bullets": [
      {
        "text": "…",
        "citations": [{"hunk": "h1", "side": "added", "quote": "…"}]
      }
    ]
  }
}
```

Compatibility rules:

- Adding word-level spans later means populating `word_spans` — no version
  bump, no re-materialisation of published records.
- Consumers MUST treat `word_spans: null` and a missing `summary` as normal.
- `summary_attempts` (optional, a positive integer) is written by T3 on an
  unsummarised record each time a summarize run fails on that record's own
  account, and removed when a summary is written. Consumers ignore it.
- `schema_version` bumps only on a breaking change to existing fields.
