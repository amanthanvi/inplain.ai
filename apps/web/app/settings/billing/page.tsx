import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

function clerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

export default async function BillingSettingsPage() {
  if (!clerkEnabled()) {
    return (
      <main>
        <header className="pageHeader">
          <div className="kicker">Account</div>
          <h1 className="pageTitle">Billing</h1>
          <p className="pageLead">Billing is not configured for this environment yet.</p>
        </header>
        <div className="card cardPad">
          <Link className="btn btnPrimary" href="/pricing">
            Back to pricing
          </Link>
        </div>
      </main>
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return (
      <main>
        <header className="pageHeader">
          <div className="kicker">Account</div>
          <h1 className="pageTitle">Billing</h1>
          <p className="pageLead">Sign in required.</p>
        </header>
        <div className="card cardPad">
          <Link className="btn btnPrimary" href="/pricing">
            Back to pricing
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header className="pageHeader">
        <div className="kicker">Account</div>
        <h1 className="pageTitle">Billing</h1>
        <p className="pageLead">Manage your subscription and payment method in Clerk.</p>
      </header>

      <section className="card cardPad">
        <UserProfile path="/settings/billing" routing="path" />
      </section>
    </main>
  );
}
