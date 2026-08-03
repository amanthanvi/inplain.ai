"use client";

import { useCallback, useMemo, useState } from "react";

import type { Citation, DiffHunk, SummaryBullet } from "@/lib/internal-api";
import { recordCitationClick } from "@/app/actions/change_events";

type DiffMode = "section" | "unified" | "split";

type RevealHunk = (hunkId: string) => void;

function scrollToHunk(hunkId: string) {
  const el = document.getElementById(`hunk-${hunkId}`);
  if (!el) return;

  const details = el.closest("details");
  if (details instanceof HTMLDetailsElement && !details.open) {
    details.open = true;
  }

  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("hunkHighlight");
  window.setTimeout(() => el.classList.remove("hunkHighlight"), 2000);
}

function citationLabel(hunkId: string): string {
  const cleaned = (hunkId || "").trim();
  const match = /^h(\d+)$/i.exec(cleaned);
  if (match) return match[1];
  return cleaned || "?";
}

function citationTooltip(quote: string): string | undefined {
  const cleaned = quote.trim().replace(/\s+/g, " ");
  if (!cleaned) return undefined;
  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

function CitationMark({
  citation,
  knownHunk,
  onRevealHunk,
  onCitationClick,
}: {
  citation: Citation;
  knownHunk: boolean;
  onRevealHunk?: RevealHunk;
  onCitationClick?: (hunkId: string) => void;
}) {
  const isUnverified = citation.status === "unverified" || !knownHunk;
  const label = citationLabel(citation.hunkId);
  const tooltip = citationTooltip(citation.quote || "");

  const onClick = useCallback(() => {
    onRevealHunk?.(citation.hunkId);
    scrollToHunk(citation.hunkId);
    onCitationClick?.(citation.hunkId);
  }, [citation.hunkId, onRevealHunk, onCitationClick]);

  if (isUnverified) {
    return (
      <sup className="citationSup">
        <span
          className="citation citationInline citationUnverified"
          aria-label={`${citation.hunkId} unverified citation`}
          title={tooltip}
        >
          {`[${label}]`}
        </span>
      </sup>
    );
  }

  return (
    <sup className="citationSup">
      <button className="citation citationInline" type="button" onClick={onClick} title={tooltip}>
        {`[${label}]`}
      </button>
    </sup>
  );
}

function Bullet({
  bullet,
  hunkIds,
  onRevealHunk,
  onCitationClick,
}: {
  bullet: SummaryBullet;
  hunkIds: Set<string>;
  onRevealHunk?: RevealHunk;
  onCitationClick?: (hunkId: string) => void;
}) {
  const citations: Citation[] = [];
  const seenHunkIds = new Set<string>();
  for (const c of bullet.citations) {
    if (seenHunkIds.has(c.hunkId)) continue;
    seenHunkIds.add(c.hunkId);
    citations.push(c);
  }

  return (
    <li className="summaryBullet">
      <div className="summaryBulletText">
        {bullet.text}
        <span className="citationInlineRow">
          {citations.map((c, idx) => (
            <CitationMark
              key={`${c.hunkId}-${idx}`}
              citation={c}
              knownHunk={hunkIds.has(c.hunkId)}
              onRevealHunk={onRevealHunk}
              onCitationClick={onCitationClick}
            />
          ))}
        </span>
      </div>
    </li>
  );
}

function shortHeading(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 72) return cleaned;
  return `${cleaned.slice(0, 69)}...`;
}

function sectionTitleForHunk(hunk: DiffHunk, index: number): string {
  const candidates = [hunk.contextBefore, hunk.contextAfter, ...hunk.added, ...hunk.removed]
    .flatMap((value) => value.split("\n"))
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of candidates) {
    if (/^(#{1,6}\s+|section\s+\d+|[0-9]+\.)/i.test(line)) {
      return shortHeading(line.replace(/^#{1,6}\s+/, ""));
    }
    if (/^[A-Z][A-Z0-9\s:&/\-]{10,}$/.test(line)) {
      return shortHeading(line);
    }
  }

  return `General changes ${index + 1}`;
}

type HunkSection = {
  title: string;
  hunks: DiffHunk[];
};

function groupHunksBySection(hunks: DiffHunk[]): HunkSection[] {
  const grouped = new Map<string, DiffHunk[]>();
  hunks.forEach((hunk, idx) => {
    const title = sectionTitleForHunk(hunk, idx);
    const list = grouped.get(title) || [];
    list.push(hunk);
    grouped.set(title, list);
  });
  return Array.from(grouped.entries()).map(([title, list]) => ({ title, hunks: list }));
}

function UnifiedHunk({ hunk }: { hunk: DiffHunk }) {
  return (
    <article id={`hunk-${hunk.hunkId}`} className="hunk">
      <div className="hunkHeader">
        <span className="pill">{hunk.hunkId}</span>
      </div>
      <div className="hunkBody">
        {hunk.contextBefore ? <div className="diffContext muted">{hunk.contextBefore}</div> : null}
        {hunk.removed.length > 0 ? (
          <div className="diffRemoved">{hunk.removed.join("")}</div>
        ) : null}
        {hunk.added.length > 0 ? <div className="diffAdded">{hunk.added.join("")}</div> : null}
        {hunk.contextAfter ? <div className="diffContext muted">{hunk.contextAfter}</div> : null}
      </div>
    </article>
  );
}

function SplitHunk({ hunk }: { hunk: DiffHunk }) {
  return (
    <article id={`hunk-${hunk.hunkId}`} className="hunk">
      <div className="hunkHeader">
        <span className="pill">{hunk.hunkId}</span>
      </div>
      <div className="hunkBody">
        {hunk.contextBefore ? <div className="diffContext muted">{hunk.contextBefore}</div> : null}
        <div className="diffSplitGrid">
          <div>
            <div className="diffSplitLabel muted">Removed</div>
            {hunk.removed.length > 0 ? (
              <div className="diffRemoved">{hunk.removed.join("")}</div>
            ) : (
              <div className="diffEmpty muted">No removals</div>
            )}
          </div>
          <div>
            <div className="diffSplitLabel muted">Added</div>
            {hunk.added.length > 0 ? (
              <div className="diffAdded">{hunk.added.join("")}</div>
            ) : (
              <div className="diffEmpty muted">No additions</div>
            )}
          </div>
        </div>
        {hunk.contextAfter ? <div className="diffContext muted">{hunk.contextAfter}</div> : null}
      </div>
    </article>
  );
}

function ExpandCollapseAllIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8l4-4 4 4" />
      <path d="M6 12l4 4 4-4" />
    </svg>
  );
}

export function ChangeEventViewer({
  changeEventId,
  whatChanged,
  whyMatters,
  hunks,
  summaryStatus,
}: {
  changeEventId: string;
  whatChanged: SummaryBullet[] | null;
  whyMatters: SummaryBullet[] | null;
  hunks: DiffHunk[];
  summaryStatus?: string;
}) {
  const summaryInitialBullets = 6;
  const [diffMode, setDiffMode] = useState<DiffMode>("section");
  const hunkIds = new Set(hunks.map((h) => h.hunkId));

  const sections = useMemo(() => groupHunksBySection(hunks), [hunks]);

  const [openSectionTitles, setOpenSectionTitles] = useState<Set<string>>(() => {
    const initial = groupHunksBySection(hunks);
    return new Set(initial.length > 0 ? [initial[0].title] : []);
  });

  const [showAllWhatChanged, setShowAllWhatChanged] = useState(false);
  const [showAllWhyMatters, setShowAllWhyMatters] = useState(false);

  const visibleWhatChanged = useMemo(() => {
    if (!whatChanged) return null;
    if (showAllWhatChanged) return whatChanged;
    return whatChanged.slice(0, summaryInitialBullets);
  }, [showAllWhatChanged, summaryInitialBullets, whatChanged]);

  const visibleWhyMatters = useMemo(() => {
    if (!whyMatters) return null;
    if (showAllWhyMatters) return whyMatters;
    return whyMatters.slice(0, summaryInitialBullets);
  }, [showAllWhyMatters, summaryInitialBullets, whyMatters]);

  const whatChangedHasMore = Boolean(whatChanged && whatChanged.length > summaryInitialBullets);
  const whyMattersHasMore = Boolean(whyMatters && whyMatters.length > summaryInitialBullets);


  const sectionTitleByHunkId = useMemo(() => {
    const map = new Map<string, string>();
    sections.forEach((section) => {
      section.hunks.forEach((hunk) => map.set(hunk.hunkId, section.title));
    });
    return map;
  }, [sections]);

  const revealHunk = useCallback<RevealHunk>(
    (hunkId) => {
      if (diffMode !== "section") return;

      const title = sectionTitleByHunkId.get(hunkId);
      if (!title) return;

      setOpenSectionTitles((prev) => {
        if (prev.has(title)) return prev;
        const next = new Set(prev);
        next.add(title);
        return next;
      });
    },
    [diffMode, sectionTitleByHunkId],
  );

  // Fire-and-forget: the scroll/highlight must not wait on analytics.
  const handleCitationClick = useCallback(
    (hunkId: string) => {
      void recordCitationClick(changeEventId, hunkId);
    },
    [changeEventId],
  );

  const allSectionsOpen =
    diffMode === "section" && sections.length > 0 && sections.every((s) => openSectionTitles.has(s.title));

  const toggleAllSections = useCallback(() => {
    if (diffMode !== "section") return;

    if (allSectionsOpen) {
      setOpenSectionTitles(new Set());
      return;
    }

    setOpenSectionTitles(new Set(sections.map((s) => s.title)));
  }, [allSectionsOpen, diffMode, sections]);

  const isEmptySummary =
    (!whatChanged || whatChanged.length === 0) && (!whyMatters || whyMatters.length === 0);

  const emptySummaryMessage =
    summaryStatus === "failed"
      ? "Summary unavailable due to an error."
      : summaryStatus === "skipped_quota"
        ? "Summary skipped due to quota limits."
        : "Summary not available yet.";

  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="card cardPad">
        <h2 className="sectionTitle">Summary</h2>
        <div className="muted finePrint" style={{ marginTop: 6 }}>
          This summary is generated by AI from the detected text changes and is provided for
          informational purposes only. It is not legal advice.
        </div>

        {whatChanged && whatChanged.length > 0 ? (
          <>
            <div style={{ height: 10 }} />
            <div className="muted" style={{ fontSize: 13, fontWeight: 650 }}>
              What changed
            </div>
            <ul className="summaryList">
              {(visibleWhatChanged || []).map((b, idx) => (
                <Bullet
                  key={idx}
                  bullet={b}
                  hunkIds={hunkIds}
                  onRevealHunk={revealHunk}
                  onCitationClick={handleCitationClick}
                />
              ))}
            </ul>
            {whatChangedHasMore ? (
              <button
                type="button"
                className="btn btnGhost summaryToggle"
                onClick={() => setShowAllWhatChanged((prev) => !prev)}
              >
                {showAllWhatChanged ? "Show less" : `Show all (${whatChanged?.length ?? 0})`}
              </button>
            ) : null}
          </>
        ) : null}

        {whyMatters && whyMatters.length > 0 ? (
          <>
            <div style={{ height: 10 }} />
            <div className="muted" style={{ fontSize: 13, fontWeight: 650 }}>
              Why it matters
            </div>
            <ul className="summaryList">
              {(visibleWhyMatters || []).map((b, idx) => (
                <Bullet
                  key={idx}
                  bullet={b}
                  hunkIds={hunkIds}
                  onRevealHunk={revealHunk}
                  onCitationClick={handleCitationClick}
                />
              ))}
            </ul>
            {whyMattersHasMore ? (
              <button
                type="button"
                className="btn btnGhost summaryToggle"
                onClick={() => setShowAllWhyMatters((prev) => !prev)}
              >
                {showAllWhyMatters ? "Show less" : `Show all (${whyMatters?.length ?? 0})`}
              </button>
            ) : null}
          </>
        ) : null}

        {isEmptySummary ? (
          <div className="muted" style={{ marginTop: 10 }}>
            {emptySummaryMessage}
          </div>
        ) : null}
      </section>

      <section className="card cardPad">
        <div className="pageTop" style={{ marginBottom: 10 }}>
          <h2 className="sectionTitle">Diff</h2>
          <div className="diffControls">
            {diffMode === "section" ? (
              <button
                type="button"
                className="btn btnGhost btnIcon"
                onClick={toggleAllSections}
                aria-label={allSectionsOpen ? "Collapse all sections" : "Expand all sections"}
                title={allSectionsOpen ? "Collapse all" : "Expand all"}
                disabled={sections.length === 0}
              >
                <ExpandCollapseAllIcon />
              </button>
            ) : null}

            <div className="diffModeRow">
              <button
                type="button"
                className={`btn btnGhost ${diffMode === "section" ? "diffModeBtnActive" : ""}`}
                onClick={() => setDiffMode("section")}
              >
                Section view
              </button>
              <button
                type="button"
                className={`btn btnGhost ${diffMode === "unified" ? "diffModeBtnActive" : ""}`}
                onClick={() => setDiffMode("unified")}
              >
                Unified
              </button>
              <button
                type="button"
                className={`btn btnGhost ${diffMode === "split" ? "diffModeBtnActive" : ""}`}
                onClick={() => setDiffMode("split")}
              >
                Side-by-side
              </button>
            </div>
          </div>
        </div>

        {diffMode === "section" ? (
          <div className="stack" style={{ gap: 10 }}>
            {sections.map((section) => (
              <details
                key={section.title}
                className="sectionDetails"
                open={openSectionTitles.has(section.title)}
                onToggle={(event) => {
                  const isOpen = event.currentTarget.open;
                  setOpenSectionTitles((prev) => {
                    const next = new Set(prev);
                    if (isOpen) next.add(section.title);
                    else next.delete(section.title);
                    return next;
                  });
                }}
              >
                <summary className="sectionDetailsSummary">
                  <span>{section.title}</span>
                  <span className="pill">{section.hunks.length} hunk(s)</span>
                </summary>
                <div className="stack" style={{ gap: 10 }}>
                  {section.hunks.map((hunk) => (
                    <UnifiedHunk key={hunk.hunkId} hunk={hunk} />
                  ))}
                </div>
              </details>
            ))}
          </div>
        ) : diffMode === "unified" ? (
          <div className="stack" style={{ gap: 10 }}>
            {hunks.map((hunk) => (
              <UnifiedHunk key={hunk.hunkId} hunk={hunk} />
            ))}
          </div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {hunks.map((hunk) => (
              <SplitHunk key={hunk.hunkId} hunk={hunk} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
