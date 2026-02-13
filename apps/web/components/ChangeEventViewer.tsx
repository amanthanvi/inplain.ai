"use client";

import { useCallback, useMemo, useState } from "react";

import type { Citation, DiffHunk, SummaryBullet } from "@/lib/internal-api";

type DiffMode = "section" | "unified" | "split";

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

function CitationMark({ citation, knownHunk }: { citation: Citation; knownHunk: boolean }) {
  const isUnverified = citation.status === "unverified" || !knownHunk;
  const onClick = useCallback(() => scrollToHunk(citation.hunkId), [citation.hunkId]);
  const label = citationLabel(citation.hunkId);
  const tooltip = citationTooltip(citation.quote || "");

  if (isUnverified) {
    return (
      <sup className="citationSup">
        <span
          className="citation citationInline citationUnverified"
          aria-label={`${citation.hunkId} unverified citation`}
          title={tooltip}
        >
          {label}
        </span>
      </sup>
    );
  }

  return (
    <sup className="citationSup">
      <button className="citation citationInline" type="button" onClick={onClick} title={tooltip}>
        {label}
      </button>
    </sup>
  );
}

function Bullet({ bullet, hunkIds }: { bullet: SummaryBullet; hunkIds: Set<string> }) {
  return (
    <li className="summaryBullet">
      <div className="summaryBulletText">
        {bullet.text}
        <span className="citationInlineRow">
          {bullet.citations.map((c, idx) => (
            <CitationMark
              key={`${c.hunkId}-${idx}`}
              citation={c}
              knownHunk={hunkIds.has(c.hunkId)}
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
          <div className="diffRemoved">
            {hunk.removed.map((t, idx) => (
              <span key={idx}>{t}</span>
            ))}
          </div>
        ) : null}
        {hunk.added.length > 0 ? (
          <div className="diffAdded">
            {hunk.added.map((t, idx) => (
              <span key={idx}>{t}</span>
            ))}
          </div>
        ) : null}
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
              <div className="diffRemoved">
                {hunk.removed.map((t, idx) => (
                  <span key={idx}>{t}</span>
                ))}
              </div>
            ) : (
              <div className="diffEmpty muted">No removals</div>
            )}
          </div>
          <div>
            <div className="diffSplitLabel muted">Added</div>
            {hunk.added.length > 0 ? (
              <div className="diffAdded">
                {hunk.added.map((t, idx) => (
                  <span key={idx}>{t}</span>
                ))}
              </div>
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

export function ChangeEventViewer({
  whatChanged,
  whyMatters,
  hunks,
  summaryStatus,
}: {
  whatChanged: SummaryBullet[] | null;
  whyMatters: SummaryBullet[] | null;
  hunks: DiffHunk[];
  summaryStatus?: string;
}) {
  const [diffMode, setDiffMode] = useState<DiffMode>("section");
  const hunkIds = new Set(hunks.map((h) => h.hunkId));
  const sections = useMemo(() => groupHunksBySection(hunks), [hunks]);
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
              {whatChanged.map((b, idx) => (
                <Bullet key={idx} bullet={b} hunkIds={hunkIds} />
              ))}
            </ul>
          </>
        ) : null}

        {whyMatters && whyMatters.length > 0 ? (
          <>
            <div style={{ height: 10 }} />
            <div className="muted" style={{ fontSize: 13, fontWeight: 650 }}>
              Why it matters
            </div>
            <ul className="summaryList">
              {whyMatters.map((b, idx) => (
                <Bullet key={idx} bullet={b} hunkIds={hunkIds} />
              ))}
            </ul>
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

        {diffMode === "section" ? (
          <div className="stack" style={{ gap: 10 }}>
            {sections.map((section, idx) => (
              <details key={section.title} className="sectionDetails" open={idx === 0}>
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
