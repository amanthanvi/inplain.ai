import Link from "next/link";

import { PricingTableClient } from "@/app/pricing/PricingTableClient";
import { entitlementsForTier } from "@/lib/billing-plans";

function clerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export default function PricingPage() {
  const free = entitlementsForTier("free");
  const pro = entitlementsForTier("pro");
  const business = entitlementsForTier("business");

  return (
    <main>
      <header className="pageHeader">
        <div className="kicker">Pricing</div>
        <h1 className="pageTitle">Start free. Upgrade when you need coverage.</h1>
        <p className="pageLead">
          Clerk Billing powers checkout. This page reflects the current target quotas in{" "}
          <span className="pill">SPEC v0.2.0</span>.
        </p>
      </header>

      <section className="card cardPad">
        <div className="cardTitle">Tier limits</div>
        <p className="muted" style={{ margin: "10px 0 0" }}>
          If you’re just getting started, browse the directory and watch a few companies. Upgrade
          for faster checks, rendering, and more summary capacity.
        </p>

        <div style={{ height: 12 }} />

        <div className="tableWrap">
          <table className="pricingTable">
            <thead>
              <tr>
                <th>Feature / Quota</th>
                <th>Free</th>
                <th>Pro</th>
                <th>Business</th>
              </tr>
            </thead>
            <tbody>
              {[
                [
                  "Tracked documents",
                  String(free.trackedDocuments),
                  String(pro.trackedDocuments),
                  String(business.trackedDocuments),
                ],
                ["Schedule frequency", "daily", "every 6h", "every 1h"],
                [
                  "On-demand “Check now”",
                  `${free.checkNowPerDay}/day`,
                  `${pro.checkNowPerDay}/day`,
                  `${business.checkNowPerDay}/day`,
                ],
                [
                  "JS-render fetches",
                  `${free.renderPerMonth}/mo`,
                  `${pro.renderPerMonth}/mo`,
                  `${business.renderPerMonth.toLocaleString()}/mo`,
                ],
                [
                  "AI summaries",
                  `${free.summariesPerMonth}/mo`,
                  `${pro.summariesPerMonth.toLocaleString()}/mo`,
                  `${business.summariesPerMonth.toLocaleString()}/mo`,
                ],
                ["History retention", "90 days", "1 year", "2 years"],
                ["Export (JSON)", "Last 10 events", "Full", "Full"],
              ].map(([k, a, b, c]) => (
                <tr key={k}>
                  <td className="pricingKey">{k}</td>
                  <td>{a}</td>
                  <td>{b}</td>
                  <td>{c}</td>
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
      </section>

      {clerkEnabled() ? (
        <section className="section">
          <h2 className="sectionTitle">Checkout</h2>
          <div className="card cardPad">
            <PricingTableClient />
          </div>
        </section>
      ) : (
        <div className="card cardPad">
          <div className="cardTitle">Checkout not configured</div>
          <div className="muted" style={{ marginTop: 10 }}>
            Set Clerk environment variables to enable the Billing UI.
          </div>
        </div>
      )}
    </main>
  );
}
