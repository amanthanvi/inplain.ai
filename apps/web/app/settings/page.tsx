import { auth } from "@clerk/nextjs/server";

import { applyEntitlementsToDocuments, getEntitlementsForHas } from "@/lib/entitlements";
import { internalFetch, type UnreadCountOut, type UsageOut } from "@/lib/internal-api";

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

  const { userId, has } = await auth();
  if (!userId) {
    return (
      <main>
        <h1>Settings</h1>
        <p className="muted">Sign in required.</p>
      </main>
    );
  }

  const entitlements = getEntitlementsForHas(has);

  await applyEntitlementsToDocuments(userId, entitlements);

  const [usage, unread] = await Promise.all([
    internalFetch<UsageOut>("/internal/usage", { userId, cache: "no-store" }),
    internalFetch<UnreadCountOut>("/internal/notifications/unread-count", { userId, cache: "no-store" }),
  ]);

  return (
    <main>
      <header className="pageHeader">
        <div className="kicker">Account</div>
        <h1 className="pageTitle">Settings</h1>
        <p className="pageLead">Account and usage.</p>
      </header>

      <div className="cardsGrid">
        <div className="card cardPad">
          <div className="kicker">Current plan</div>
          <div style={{ fontSize: 28, fontWeight: 750, marginTop: 6, textTransform: "capitalize" }}>
            {entitlements.tier}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Schedule:{" "}
            {entitlements.scheduleTier === "daily"
              ? "daily"
              : entitlements.scheduleTier === "6h"
                ? "every 6 hours"
                : "every 1 hour"}
          </div>
          <div style={{ marginTop: 12 }}>
            <a className="btn btnPrimary" href="/pricing">
              Upgrade
            </a>
          </div>
        </div>

        <div className="card cardPad">
          <div className="kicker">Tracked documents</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>
            {usage.tracked_documents}/{entitlements.trackedDocuments}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Limit enforcement happens in the watch flow.
          </div>
        </div>

        <div className="card cardPad">
          <div className="kicker">Unread notifications</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>{unread.unread}</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Notifications are in-app only in v0.2.0.
          </div>
        </div>

        <div className="card cardPad">
          <div className="kicker">“Check now” (today)</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>
            {usage.check_now_used_today}/{entitlements.checkNowPerDay}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Counts only user-initiated checks.
          </div>
        </div>

        <div className="card cardPad">
          <div className="kicker">AI summaries (this month)</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>
            {usage.summaries_used_month}/{entitlements.summariesPerMonth}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Summaries may be skipped when over quota.
          </div>
        </div>

        <div className="card cardPad">
          <div className="kicker">JS-render fetches (this month)</div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>
            {usage.render_used_month}/{entitlements.renderPerMonth}
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            Render fallback is used when HTTP extraction yields minimal text.
          </div>
        </div>
      </div>
    </main>
  );
}
