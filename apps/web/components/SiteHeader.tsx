import Link from "next/link";
import { NotificationBell } from "@/components/NotificationBell";

export async function SiteHeader({ clerkEnabled }: { clerkEnabled: boolean }) {
  if (!clerkEnabled) {
    return (
      <header className="siteHeader">
        <div className="siteHeaderInner">
          <Link href="/" className="brand">
            inplain
          </Link>

          <nav className="nav">
            <Link href="/companies">Companies</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/about">About</Link>
          </nav>

          <div className="navRight">
            <span className="muted" style={{ fontSize: 12 }}>
              Auth disabled (set Clerk env)
            </span>
          </div>
        </div>
      </header>
    );
  }

  const { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } = await import(
    "@clerk/nextjs"
  );

  return (
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <Link href="/" className="brand">
          inplain
        </Link>

        <nav className="nav">
          <Link href="/companies">Companies</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          {clerkEnabled ? (
            <SignedIn>
              <Link href="/dashboard">Dashboard</Link>
            </SignedIn>
          ) : null}
        </nav>

        <div className="navRight">
          <>
            <SignedOut>
              <SignInButton>
                <button className="btn btnGhost" type="button">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton>
                <button className="btn btnPrimary" type="button">
                  Start free
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <NotificationBell />
              <UserButton />
            </SignedIn>
          </>
        </div>
      </div>
    </header>
  );
}
