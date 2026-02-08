import Link from "next/link";

import { PricingTableClient } from "@/app/pricing/PricingTableClient";

function clerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export default function PricingPage() {
  return (
    <main>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)" }}>Pricing</h1>
      <p className="muted" style={{ margin: "10px 0 0" }}>
        Start free. Upgrade when you need more coverage and faster checks.
      </p>

      <div style={{ height: 18 }} />

      <div className="card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700 }}>Tier limits (SPEC v0.2.0)</div>
        <div className="muted" style={{ marginTop: 6 }}>
          Clerk Billing powers checkout; this table shows the current target quotas.
        </div>

        <div style={{ height: 12 }} />

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>
                  Feature / Quota
                </th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>
                  Free
                </th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>
                  Pro
                </th>
                <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>
                  Business
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Tracked documents", "3", "25", "200"],
                ["Schedule frequency", "daily", "every 6h", "every 1h"],
                ["On-demand “Check now”", "10/day", "100/day", "500/day"],
                ["JS-render fetches", "0/mo", "200/mo", "2,000/mo"],
                ["AI summaries", "10/mo", "500/mo", "5,000/mo"],
                ["History retention", "90 days", "1 year", "2 years"],
                ["Export (JSON)", "Last 10 events", "Full", "Full"],
              ].map(([k, a, b, c]) => (
                <tr key={k}>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                    {k}
                  </td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>{a}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>{b}</td>
                  <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ height: 14 }} />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btnPrimary" href="/companies">
            Browse companies
          </Link>
          <Link className="btn" href="/dashboard">
            Go to dashboard
          </Link>
        </div>
      </div>

      <div style={{ height: 18 }} />

      {clerkEnabled() ? (
        <section>
          <h2 style={{ margin: "0 0 10px", fontFamily: "var(--font-display)" }}>Checkout</h2>
          <div className="card" style={{ padding: 18 }}>
            <PricingTableClient />
          </div>
        </section>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 650 }}>Checkout not configured</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Set Clerk environment variables to enable the Billing UI.
          </div>
        </div>
      )}
    </main>
  );
}
