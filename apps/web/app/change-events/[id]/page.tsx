import Link from "next/link";

import { auth } from "@clerk/nextjs/server";

import { ChangeEventViewer } from "@/components/ChangeEventViewer";
import { internalFetch, type ChangeEventDetailOut } from "@/lib/internal-api";

export const dynamic = "force-dynamic";

export default async function ChangeEventPage({ params }: { params: { id: string } }) {
  const { userId } = await auth();
  if (!userId) {
    return (
      <main>
        <h1>Change event</h1>
        <p className="muted">Sign in required.</p>
      </main>
    );
  }

  const detail = await internalFetch<ChangeEventDetailOut>(`/internal/change-events/${params.id}`, {
    userId,
    cache: "no-store",
  });

  const ce = detail.change_event;

  return (
    <main>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="muted" style={{ fontSize: 13 }}>
              {new Date(ce.created_at).toLocaleString()}
            </div>
            <h1 style={{ margin: "8px 0 0", fontFamily: "var(--font-display)" }}>{ce.title}</h1>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="pill">{ce.summary_status}</span>
            <Link className="btn" href="/companies">
              Companies
            </Link>
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {ce.summary_status === "failed" ? (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 650 }}>Summary failed</div>
          <div className="muted" style={{ marginTop: 6 }}>
            {ce.summary_error || "Unknown error"}
          </div>
        </div>
      ) : null}

      <ChangeEventViewer
        whatChanged={ce.summary_what_changed}
        whyMatters={ce.summary_why_matters}
        hunks={detail.diff.diff_hunks}
      />
    </main>
  );
}

