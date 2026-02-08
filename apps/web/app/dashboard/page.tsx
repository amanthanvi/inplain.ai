import Link from "next/link";

import { auth } from "@clerk/nextjs/server";

import { internalFetch, type DocumentOut, type EntityOut } from "@/lib/internal-api";

export const dynamic = "force-dynamic";

function clerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export default async function DashboardPage() {
  if (!clerkEnabled()) {
    return (
      <main>
        <h1>Dashboard</h1>
        <p className="muted">Auth is not configured yet.</p>
      </main>
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return (
      <main>
        <h1>Dashboard</h1>
        <p className="muted">Sign in required.</p>
      </main>
    );
  }

  const [entities, docs] = await Promise.all([
    internalFetch<EntityOut[]>("/internal/entities", { cache: "no-store" }),
    internalFetch<DocumentOut[]>("/internal/documents", { userId, cache: "no-store" }),
  ]);

  const entityById = new Map(entities.map((e) => [e.id, e]));
  const docsByEntity = new Map<string, DocumentOut[]>();
  for (const d of docs) {
    const list = docsByEntity.get(d.entity_id) || [];
    list.push(d);
    docsByEntity.set(d.entity_id, list);
  }

  const watched = Array.from(docsByEntity.entries())
    .map(([entityId, entityDocs]) => {
      const entity = entityById.get(entityId);
      if (!entity) return null;
      return { entity, docs: entityDocs };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.entity.name.localeCompare(b.entity.name));

  return (
    <main>
      <header className="pageHeader">
        <div className="kicker">Account</div>
        <div className="pageTop">
          <div>
            <h1 className="pageTitle">Dashboard</h1>
            <p className="pageLead">Your watched companies.</p>
          </div>
          <div className="pageActions">
            <Link className="btn btnPrimary" href="/companies">
              Watch another company
            </Link>
          </div>
        </div>
      </header>

      {watched.length === 0 ? (
        <div className="card cardPad">
          <div className="cardTitle">No watches yet</div>
          <div className="muted" style={{ marginTop: 10 }}>
            Browse the directory and start tracking a company.
          </div>
          <div style={{ marginTop: 12 }}>
            <Link className="btn btnPrimary" href="/companies">
              Browse companies
            </Link>
          </div>
        </div>
      ) : (
        <div className="cardsGrid">
          {watched.map(({ entity, docs }) => (
            <Link key={entity.id} className="companyCard" href={`/companies/${entity.slug}`}>
              <div className="companyName">{entity.name}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                {docs.length} policy{docs.length === 1 ? "" : "ies"} tracked
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
