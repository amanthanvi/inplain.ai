# inplain.ai

A public, permanent record of how the privacy policies and terms of service of
well-known companies change: what changed, why it matters, and the evidence.

## Language

### What we watch

**Catalog**:
The curated list of Companies and the Documents we track for each. Grows only by deliberate curation.
_Avoid_: watchlist, sources, company list

**Company**:
An organisation in the Catalog, identified by a slug.
_Avoid_: site, vendor, provider

**Document**:
One public policy page of one Company, such as its privacy policy or its terms of service.
_Avoid_: policy (when you mean the page), URL, source

**Snapshot**:
The extracted text of a Document as it stood at one crawl. It is the input we diff, never something we publish.
_Avoid_: capture, version, copy

### What we publish

**Change record**:
The account of one Document changing between two Snapshots: its Hunks, its Materiality, and, once written, its Summary.
_Avoid_: diff, alert, update, event

**Hunk**:
One contiguous passage that changed, with its removed lines and added lines kept strictly apart.
_Avoid_: chunk, section, block

**Side**:
Which half of a Hunk a quote comes from: _added_ or _removed_.

**Summary**:
The plain-language explanation of a Change record, made only of Claims.
_Avoid_: analysis, insight, AI output

**Claim**:
One plain-language statement in a Summary about what changed. It needs at least one Citation, and it is published only if every one of its Citations is valid.
_Avoid_: bullet, point, finding

**Citation**:
The evidence for a Claim: a verbatim quote, the Hunk it comes from, and the Side it sits on.
_Avoid_: reference, source, footnote

**Valid citation**:
A Citation whose quote appears in the named Hunk, on the named Side, exactly or differing only in whitespace or case. A Claim with any other kind of Citation is dropped, never softened.

### What we decide

**Materiality**:
Whether a Change record is worth publishing, judged by the absolute amount of prose added or removed, with every verdict carrying its reason.
_Avoid_: significance, similarity, severity

**Suppressed**:
Recorded but not published because it is immaterial, for example a copyright line or a page number. Suppressed never means unrecorded.
_Avoid_: ignored, filtered, hidden

**Effective date**:
The "last updated" or "effective" line of a Document. A change to it alone is material.
