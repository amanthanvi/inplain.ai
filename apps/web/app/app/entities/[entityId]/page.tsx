import Link from "next/link";

import { inplainFetchJsonSafe } from "../../inplain-api";
import { AppErrorState } from "../../app-error-state";

type DocumentListItem = {
  id: string;
  url: string;
  docType: "privacy" | "tos" | "cookie" | "other";
  status: "active" | "paused" | "blocked_robots" | "error";
  robotsStatus: "unknown" | "allowed" | "disallowed";
  nextDueAt: string;
  lastCheckedAt: string | null;
  lastChangeEventId: string | null;
  createdAt: string;
};

type DocumentListResponse = {
  items: DocumentListItem[];
  nextCursor: string | null;
};

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  const docsResult = await inplainFetchJsonSafe<DocumentListResponse>(
    `/v1/entities/${entityId}/documents?limit=100`,
  );
  if (!docsResult.ok) {
    return (
      <AppErrorState
        title="Policies"
        message={docsResult.error.message}
        status={docsResult.error.status}
        code={docsResult.error.code}
        retryHref={`/app/entities/${entityId}`}
      />
    );
  }

  const docs = docsResult.data;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href="/app/entities" style={{ opacity: 0.7 }}>
          ← Back to tracking
        </Link>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Policies</h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Tracking ID: {entityId}</div>
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 650 }}>Track more companies</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Add companies from the curated directory — we’ll attach the standard policy URLs
          automatically.
        </div>
        <Link
          href="/companies"
          style={{
            justifySelf: "start",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            color: "inherit",
          }}
        >
          Browse companies →
        </Link>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {docs.items.map((d) => (
          <Link
            key={d.id}
            href={`/app/documents/${d.id}`}
            style={{
              display: "grid",
              gap: 6,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.url}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{d.status}</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.7 }}>
              <span>{d.docType}</span>
              <span>· robots {d.robotsStatus}</span>
              <span>· next {new Date(d.nextDueAt).toLocaleString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
