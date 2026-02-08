import Link from "next/link";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export function SiteHeader({ clerkEnabled }: { clerkEnabled: boolean }) {
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
          {clerkEnabled ? (
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
                <UserButton />
              </SignedIn>
            </>
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>
              Auth disabled (set Clerk env)
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
