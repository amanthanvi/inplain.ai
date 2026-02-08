import { auth } from "@clerk/nextjs/server";

import { internalFetch, type DocumentOut, type UnreadCountOut } from "@/lib/internal-api";

export const dynamic = "force-dynamic";

function clerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export default async function SettingsPage() {
  if (!clerkEnabled()) {
    return (
      <main>
        <h1>Settings</h1>
        <p className="muted">Auth is not configured yet.</p>
      </main>
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return (
      <main>
        <h1>Settings</h1>
        <p className="muted">Sign in required.</p>
      </main>
    );
  }

  const [docs, unread] = await Promise.all([
    internalFetch<DocumentOut[]>("/internal/documents", { userId, cache: "no-store" }),
    internalFetch<UnreadCountOut>("/internal/notifications/unread-count", { userId, cache: "no-store" }),
  ]);

  return (
    <main>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)" }}>Settings</h1>
      <p className="muted" style={{ margin: "8px 0 0" }}>
        Account and usage.
      </p>

      <div style={{ height: 18 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            Tracked documents
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>{docs.length}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Free tier limit enforcement comes next.
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 13 }}>
            Unread notifications
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>{unread.unread}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Notifications are in-app only in v0.1.0.
          </div>
        </div>
      </div>
    </main>
  );
}

