import Link from "next/link";

import { auth } from "@clerk/nextjs/server";

import {
  internalFetch,
  type ChangeEventOut,
  type DocumentOut,
  type EntityOut,
  type SnapshotOut,
} from "@/lib/internal-api";

export const dynamic = "force-dynamic";

function clerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

function prettyCategory(category: string) {
  return category.replaceAll("_", " ");
}

function formatDocType(t: DocumentOut["doc_type"]) {
  switch (t) {
    case "privacy":
      return "Privacy Policy";
    case "tos":
      return "Terms of Service";
    case "cookie":
      return "Cookie Policy";
    default:
      return "Policy";
  }
}

function formatStatus(doc: DocumentOut) {
  if (doc.status === "blocked_robots") return "Blocked by robots.txt";
  if (doc.status === "paused") return "Paused (URL not accessible)";
  if (doc.status === "error") return "Last check failed";
  return "Active";
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const { slug } = params;

  const entity = await internalFetch<EntityOut>(`/internal/entities/${slug}`, { cache: "no-store" });

  let userId: string | null = null;
  if (clerkEnabled()) {
    const session = await auth();
    userId = session.userId;
  }

  const documents = userId
    ? await internalFetch<DocumentOut[]>("/internal/documents", { userId, cache: "no-store" })
    : [];

  const tracked = documents.filter((d) => d.entity_id === entity.id);
  const trackedIds = new Set(tracked.map((d) => d.id));

  const snapshotsById = new Map<string, SnapshotOut>();
  await Promise.all(
    tracked
      .filter((d) => d.last_snapshot_id)
      .map(async (d) => {
        const snap = await internalFetch<SnapshotOut>(`/internal/snapshots/${d.last_snapshot_id}`, {
          userId: userId ?? undefined,
          cache: "no-store",
        });
        snapshotsById.set(d.id, snap);
      }),
  );

  const changeEvents = userId
    ? await internalFetch<ChangeEventOut[]>("/internal/change-events", { userId, cache: "no-store" })
    : [];
  const relevantEvents = changeEvents.filter((e) => trackedIds.has(e.document_id)).slice(0, 20);

  const isWatched = tracked.length > 0;

  return (
    <main>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div className="muted" style={{ fontSize: 13 }}>
              {prettyCategory(entity.category)}
            </div>
            <h1 style={{ margin: "8px 0 6px", fontFamily: "var(--font-display)" }}>
              {entity.name}
            </h1>
            <div className="muted" style={{ fontSize: 14 }}>
              <a href={entity.website_url} target="_blank" rel="noreferrer">
                {entity.website_url}
              </a>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {isWatched ? (
              <span className="pill">Watching</span>
            ) : (
              <Link className="btn btnPrimary" href={`/watch/complete?entity=${entity.slug}`}>
                Watch changes
              </Link>
            )}
            <Link className="btn" href="/companies">
              Back to directory
            </Link>
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <section>
        <h2 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)" }}>Tracked documents</h2>

        {!userId ? (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 650 }}>Sign in to watch {entity.name}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              You can browse the catalog signed out. Watching starts after sign in.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btnPrimary" href={`/watch/complete?entity=${entity.slug}`}>
                Watch changes
              </Link>
            </div>
          </div>
        ) : tracked.length === 0 ? (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 650 }}>Not tracking yet</div>
            <div className="muted" style={{ marginTop: 6 }}>
              Start watching to enqueue the first snapshot fetch.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btnPrimary" href={`/watch/complete?entity=${entity.slug}`}>
                Watch changes
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {tracked.map((doc) => {
              const snap = snapshotsById.get(doc.id);
              const pending = !doc.last_snapshot_id;
              return (
                <div key={doc.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 650 }}>{formatDocType(doc.doc_type)}</div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                        {formatStatus(doc)}
                        {doc.status === "blocked_robots" && doc.robots_rule ? ` • ${doc.robots_rule}` : ""}
                      </div>
                    </div>
                    <span className="pill">{pending ? "First snapshot pending…" : "Tracked"}</span>
                  </div>

                  <div style={{ height: 12 }} />

                  {snap ? (
                    <details>
                      <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                        Current policy text
                      </summary>
                      <div
                        style={{
                          marginTop: 10,
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: 12,
                          background: "rgba(20,18,16,0.02)",
                          whiteSpace: "pre-wrap",
                          maxHeight: 320,
                          overflow: "auto",
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        {snap.extracted_text}
                      </div>
                    </details>
                  ) : (
                    <div className="muted" style={{ fontSize: 14 }}>
                      {pending ? "Waiting for the first snapshot…" : "No current snapshot available."}
                    </div>
                  )}

                  <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
                    URL:{" "}
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      {doc.url}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div style={{ height: 26 }} />

      <section>
        <h2 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)" }}>Changes</h2>
        {!userId ? (
          <div className="muted">Sign in to see your watch history and AI summaries.</div>
        ) : relevantEvents.length === 0 ? (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 650 }}>No changes yet</div>
            <div className="muted" style={{ marginTop: 6 }}>
              When a meaningful change is detected, you’ll see it here with a summary and citations.
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            {relevantEvents.map((e) => (
              <div key={e.id} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 650 }}>{e.title}</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span className="pill">{e.summary_status}</span>
                    <Link className="btn btnGhost" href={`/change-events/${e.id}`}>
                      View
                    </Link>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {new Date(e.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
