"use client";

import { useCallback } from "react";

import type { Citation, DiffHunk, SummaryBullet } from "@/lib/internal-api";

function scrollToHunk(hunkId: string) {
  const el = document.getElementById(`hunk-${hunkId}`);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("hunkHighlight");
  window.setTimeout(() => el.classList.remove("hunkHighlight"), 2000);
}

function CitationPill({ citation }: { citation: Citation }) {
  const onClick = useCallback(() => scrollToHunk(citation.hunkId), [citation.hunkId]);
  return (
    <button className="citation" type="button" onClick={onClick}>
      {citation.hunkId}
    </button>
  );
}

function Bullet({ bullet }: { bullet: SummaryBullet }) {
  return (
    <li className="summaryBullet">
      <div>{bullet.text}</div>
      <div className="citationRow">
        {bullet.citations.map((c, idx) => (
          <CitationPill key={`${c.hunkId}-${idx}`} citation={c} />
        ))}
      </div>
    </li>
  );
}

export function ChangeEventViewer({
  whatChanged,
  whyMatters,
  hunks,
}: {
  whatChanged: SummaryBullet[] | null;
  whyMatters: SummaryBullet[] | null;
  hunks: DiffHunk[];
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>Summary</h2>

        {whatChanged && whatChanged.length > 0 ? (
          <>
            <div style={{ height: 10 }} />
            <div className="muted" style={{ fontSize: 13, fontWeight: 650 }}>
              What changed
            </div>
            <ul className="summaryList">
              {whatChanged.map((b, idx) => (
                <Bullet key={idx} bullet={b} />
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
                <Bullet key={idx} bullet={b} />
              ))}
            </ul>
          </>
        ) : null}

        {!whatChanged && !whyMatters ? (
          <div className="muted" style={{ marginTop: 10 }}>
            Summary not available yet.
          </div>
        ) : null}
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)" }}>Diff</h2>
        <div style={{ height: 10 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {hunks.map((h) => (
            <article key={h.hunkId} id={`hunk-${h.hunkId}`} className="hunk">
              <div className="hunkHeader">
                <span className="pill">{h.hunkId}</span>
              </div>
              <div className="hunkBody">
                {h.contextBefore ? (
                  <div className="diffContext muted">{h.contextBefore}</div>
                ) : null}
                {h.removed.length > 0 ? (
                  <div className="diffRemoved">
                    {h.removed.map((t, idx) => (
                      <span key={idx}>{t}</span>
                    ))}
                  </div>
                ) : null}
                {h.added.length > 0 ? (
                  <div className="diffAdded">
                    {h.added.map((t, idx) => (
                      <span key={idx}>{t}</span>
                    ))}
                  </div>
                ) : null}
                {h.contextAfter ? <div className="diffContext muted">{h.contextAfter}</div> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

