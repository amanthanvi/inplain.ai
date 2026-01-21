import Link from "next/link";

import { inplainFetchJsonSafe } from "../../inplain-api";
import { AppErrorState } from "../../app-error-state";
import { formatDateTime } from "../../format";

type Citation = {
  hunkId: string;
  quote: string;
  side: "added" | "removed";
};

type SummaryBullet = {
  text: string;
  citations: Citation[];
  citationInvalid?: boolean;
};

type ChangeEventResponse = {
  id: string;
  documentId: string;
  title: string;
  createdAt: string;
  summary: {
    whatChanged: SummaryBullet[];
    whyItMatters: SummaryBullet[];
    disclaimer: string;
  } | null;
  diff: {
    format: "unified" | string;
    unified: string;
    hunks: Array<{
      hunkId: string;
      context: string;
      added: string[];
      removed: string[];
    }>;
  };
};

function DiffHunk({ hunk }: { hunk: ChangeEventResponse["diff"]["hunks"][number] }) {
  return (
    <div
      id={`hunk-${hunk.hunkId}`}
      style={{
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)",
        overflow: "hidden",
        scrollMarginTop: 80,
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          fontSize: 12,
          opacity: 0.75,
        }}
      >
        <div>
          <span style={{ opacity: 0.9 }}>{hunk.hunkId}</span>
          {hunk.context ? <span> · {hunk.context}</span> : null}
        </div>
      </div>
      <div
        style={{
          margin: 0,
          padding: 12,
          fontSize: 12,
          lineHeight: 1.6,
          overflowX: "auto",
          whiteSpace: "pre",
          fontFamily:
            "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        {hunk.removed.map((line, idx) => (
          <div key={`r-${idx}`} style={{ color: "#ff9aa4" }}>
            - {line}
          </div>
        ))}
        {hunk.added.map((line, idx) => (
          <div key={`a-${idx}`} style={{ color: "#98f5c4" }}>
            + {line}
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function ChangeEventPage({
  params,
}: {
  params: Promise<{ changeEventId: string }>;
}) {
  const { changeEventId } = await params;
  const eventResult = await inplainFetchJsonSafe<ChangeEventResponse>(`/v1/change-events/${changeEventId}`);
  if (!eventResult.ok) {
    return (
      <AppErrorState
        title="Change event"
        message={eventResult.error.message}
        status={eventResult.error.status}
        code={eventResult.error.code}
        retryHref={`/app/change-events/${changeEventId}`}
      />
    );
  }

  const event = eventResult.data;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href={`/app/documents/${event.documentId}`} style={{ opacity: 0.7 }}>
          ← Document
        </Link>
        <h1 style={{ fontSize: 18, letterSpacing: "-0.02em" }}>{event.title}</h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.75 }}>
            {formatDateTime(event.createdAt)}
          </div>
          <a
            href={`/api/export/change-events/${event.id}`}
            style={{ fontSize: 12, opacity: 0.8 }}
          >
            Export JSON →
          </a>
        </div>
      </div>

      {event.summary ? (
        <div
          style={{
            display: "grid",
            gap: 10,
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontWeight: 650 }}>Summary</div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>What changed</div>
            <ul style={{ display: "grid", gap: 10, paddingLeft: 16 }}>
              {event.summary.whatChanged.map((b, idx) => (
                <li key={idx} style={{ fontSize: 14, lineHeight: 1.5 }}>
                  <div>{b.text}</div>
                  {b.citations?.length ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {b.citations.map((c, cIdx) => (
                        <a
                          key={cIdx}
                          href={`#hunk-${c.hunkId}`}
                          title={c.quote}
                          style={{
                            fontSize: 12,
                            opacity: 0.75,
                            textDecoration: "none",
                            border: "1px solid rgba(255,255,255,0.14)",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          {c.side === "added" ? "+" : "-"} {c.hunkId}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Why it matters</div>
            <ul style={{ display: "grid", gap: 10, paddingLeft: 16 }}>
              {event.summary.whyItMatters.map((b, idx) => (
                <li key={idx} style={{ fontSize: 14, lineHeight: 1.5 }}>
                  <div>{b.text}</div>
                  {b.citations?.length ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {b.citations.map((c, cIdx) => (
                        <a
                          key={cIdx}
                          href={`#hunk-${c.hunkId}`}
                          title={c.quote}
                          style={{
                            fontSize: 12,
                            opacity: 0.75,
                            textDecoration: "none",
                            border: "1px solid rgba(255,255,255,0.14)",
                            borderRadius: 999,
                            padding: "2px 8px",
                          }}
                        >
                          {c.side === "added" ? "+" : "-"} {c.hunkId}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{event.summary.disclaimer}</div>
        </div>
      ) : (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            fontSize: 13,
            opacity: 0.9,
          }}
        >
          AI summary unavailable yet. You can still review the diff below.
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 15, opacity: 0.85 }}>Diff</h2>
        {event.diff.hunks.map((h) => (
          <DiffHunk key={h.hunkId} hunk={h} />
        ))}
      </div>
    </div>
  );
}
