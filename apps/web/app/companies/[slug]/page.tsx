import Link from "next/link";

import { auth } from "@clerk/nextjs/server";

import { checkNow, unwatchEntity } from "@/app/actions/documents";
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
  if (doc.status === "paused") return "URL no longer accessible";
  if (doc.status === "error") return "Last check failed";
  return "Active";
}

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { upgrade?: string; reason?: string };
}) {
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

  const upgradeBlocked = searchParams.upgrade === "1";
  const upgradeReason = searchParams.reason;

  const upgradeCopy =
    upgradeReason === "check_now_quota"
      ? {
          title: "Daily limit reached",
          body: "You’ve hit your plan’s daily “Check now” limit. Upgrade to get more on‑demand checks.",
        }
      : upgradeReason === "doc_limit"
        ? {
            title: "Upgrade required",
            body: "You’ve reached your plan’s tracked document limit. Upgrade to track more documents.",
          }
        : {
            title: "Upgrade required",
            body: "This action is blocked on your current plan. Upgrade to continue.",
          };

  return (
    <main>
      {upgradeBlocked ? (
        <>
          <div className="card cardPad" style={{ borderColor: "rgba(255,77,46,0.35)" }}>
            <div className="cardTitle">{upgradeCopy.title}</div>
            <div className="muted" style={{ marginTop: 10 }}>
              {upgradeCopy.body}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="btn btnPrimary" href="/pricing">
                See pricing
              </Link>
              <Link className="btn" href="/dashboard">
                Go to dashboard
              </Link>
            </div>
          </div>
          <div style={{ height: 18 }} />
        </>
      ) : null}
      <header className="pageHeader">
        <div className="kicker">{prettyCategory(entity.category)}</div>
        <div className="pageTop">
          <div style={{ minWidth: 0 }}>
            <h1 className="pageTitle">{entity.name}</h1>
            <p className="pageLead">
              <a href={entity.website_url} target="_blank" rel="noreferrer">
                {entity.website_url}
              </a>
            </p>
          </div>

          <div className="pageActions">
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
      </header>

      <section className="section">
        <div className="sectionTitleRow">
          <h2 className="sectionTitle">Tracked documents</h2>
          <p className="sectionLead muted">
            Watch to fetch the first snapshot, then review diffs and citations as changes happen.
          </p>
        </div>

        {!userId ? (
          <div className="card cardPad">
            <div className="cardTitle">Sign in to watch {entity.name}</div>
            <div className="muted" style={{ marginTop: 10 }}>
              You can browse the catalog signed out. Watching starts after sign in.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btnPrimary" href={`/watch/complete?entity=${entity.slug}`}>
                Watch changes
              </Link>
            </div>
            <div className="muted finePrint" style={{ marginTop: 10 }}>
              Informational only. Not legal advice.
            </div>
          </div>
        ) : tracked.length === 0 ? (
          <div className="card cardPad">
            <div className="cardTitle">Not tracking yet</div>
            <div className="muted" style={{ marginTop: 10 }}>
              Start watching to enqueue the first snapshot fetch.
            </div>
            <div style={{ marginTop: 12 }}>
              <Link className="btn btnPrimary" href={`/watch/complete?entity=${entity.slug}`}>
                Watch changes
              </Link>
            </div>
            <div className="muted finePrint" style={{ marginTop: 10 }}>
              Informational only. Not legal advice.
            </div>
          </div>
        ) : (
          <>
            <form
              action={unwatchEntity}
              className="pageActions"
              style={{ justifyContent: "flex-end" }}
            >
              <input type="hidden" name="entitySlug" value={entity.slug} />
              {tracked.map((d) => (
                <input key={d.id} type="hidden" name="documentId" value={d.id} />
              ))}
              <button className="btn btnGhost" type="submit">
                Stop tracking
              </button>
            </form>

            <div style={{ height: 12 }} />

            <div className="stack">
              {tracked.map((doc) => {
                const snap = snapshotsById.get(doc.id);
                const pending = !doc.last_snapshot_id;
                return (
                  <div key={doc.id} className="card cardPad">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 650 }}>{formatDocType(doc.doc_type)}</div>
                        <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                          {formatStatus(doc)}
                          {doc.status === "blocked_robots" && doc.robots_rule
                            ? ` • ${doc.robots_rule}`
                            : ""}
                        </div>
                      </div>
                      <span className="pill">{pending ? "First snapshot pending…" : "Tracked"}</span>
                    </div>

                    <div style={{ height: 10 }} />

                    <form action={checkNow} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <input type="hidden" name="documentId" value={doc.id} />
                      <input type="hidden" name="entitySlug" value={entity.slug} />
                      <button className="btn btnGhost" type="submit">
                        Check now
                      </button>
                    </form>

                    <div style={{ height: 12 }} />

                    {snap ? (
                      <details>
                        <summary className="detailsSummary">Current policy text</summary>
                        <div className="policyTextBox">
                          {snap.extracted_text}
                        </div>
                      </details>
                    ) : (
                      <div className="muted" style={{ fontSize: 14 }}>
                        {pending
                          ? "Waiting for the first snapshot…"
                          : "No current snapshot available."}
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
          </>
        )}
      </section>

      <section className="section">
        <div className="sectionTitleRow">
          <h2 className="sectionTitle">Changes</h2>
          <p className="sectionLead muted">
            Meaningful policy updates appear here with a diff and citation-backed summary.
          </p>
        </div>
        {!userId ? (
          <div className="card cardPad">
            <div className="cardTitle">Sign in to view your history</div>
            <div className="muted" style={{ marginTop: 10 }}>
              Changes and AI summaries appear after you start watching.
            </div>
          </div>
        ) : relevantEvents.length === 0 ? (
          <div className="card cardPad">
            <div className="cardTitle">No changes yet</div>
            <div className="muted" style={{ marginTop: 10 }}>
              When a meaningful change is detected, you’ll see it here with a summary and citations.
            </div>
          </div>
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            {relevantEvents.map((e) => (
              <div key={e.id} className="card cardPad">
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
