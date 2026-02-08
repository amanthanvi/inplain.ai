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
      <header className="pageHeader">
        <div className="kicker">{new Date(ce.created_at).toLocaleString()}</div>
        <div className="pageTop">
          <div style={{ minWidth: 0 }}>
            <h1 className="pageTitle">{ce.title}</h1>
          </div>
          <div className="pageActions">
            <span className="pill">{ce.summary_status}</span>
            <Link className="btn" href="/companies">
              Companies
            </Link>
          </div>
        </div>
      </header>

      {ce.summary_status === "failed" ? (
        <div className="card cardPad" style={{ borderColor: "rgba(255,77,46,0.35)" }}>
          <div className="cardTitle">Summary failed</div>
          <div className="muted" style={{ marginTop: 10 }}>
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
