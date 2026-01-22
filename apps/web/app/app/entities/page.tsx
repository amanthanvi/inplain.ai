import Link from "next/link";

import { inplainFetchJsonSafe } from "../inplain-api";
import { AppErrorState } from "../app-error-state";

type Entity = {
  id: string;
  name: string;
  websiteUrl: string | null;
  createdAt: string;
};

type EntityListResponse = {
  items: Entity[];
  nextCursor: string | null;
};

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ unwatched?: string }>;
}) {
  const sp = await searchParams;
  const entitiesResult = await inplainFetchJsonSafe<EntityListResponse>("/v1/entities?limit=100");
  if (!entitiesResult.ok) {
    return (
      <AppErrorState
        title="Tracking"
        message={entitiesResult.error.message}
        status={entitiesResult.error.status}
        code={entitiesResult.error.code}
        retryHref="/app/entities"
      />
    );
  }

  const entities = entitiesResult.data;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Tracking</h1>
        <div style={{ opacity: 0.7 }}>{entities.items.length} companies</div>
      </div>

      {sp.unwatched === "1" ? (
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
          Company removed from tracking.
        </div>
      ) : null}

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
        <div style={{ fontWeight: 650 }}>Add companies</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Browse the curated directory and click “Watch changes” on any company you want to track.
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {entities.items.map((e) => (
          <Link
            key={e.id}
            href={`/app/entities/${e.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontWeight: 650 }}>{e.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {e.websiteUrl ? e.websiteUrl : "—"}
              </div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
