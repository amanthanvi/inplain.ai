A "launch empty" tree that already holds Snapshots is not empty: the first crawl diffs against them.

The v0.3 tree carried 53 Document Snapshots committed on 2026-08-20 as the
diffing substrate. The first scheduled-style crawl on 2026-09-27 therefore
compared five-week-old text against today's Documents and produced 15 real
Change records (run 36311267387). Change detection always diffs against the
last committed Snapshot, never against "yesterday", so a gap between the
baseline commit and the first crawl becomes the first batch of records.

This is not a Wayback backfill and the lead kept the records (provisional
decision on #34). If a truly zero-record launch is wanted, the Snapshots and
`changes/` must be reset immediately before the first crawl, not weeks
before.
