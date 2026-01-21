"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

import styles from "./site-header.module.css";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const inApp = pathname.startsWith("/app");

  return (
    <header className={`${styles.header} ${inApp ? styles.appHeader : ""}`}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandDot} aria-hidden="true" />
            Inplain
          </Link>

          {!inApp ? (
            <nav className={styles.nav} aria-label="Main">
              <Link
                className={`${styles.navLink} ${isActive(pathname, "/") ? styles.navLinkActive : ""}`}
                href="/"
              >
                Home
              </Link>
              <Link
                className={`${styles.navLink} ${isActive(pathname, "/companies") ? styles.navLinkActive : ""}`}
                href="/companies"
              >
                Companies
              </Link>
              <Link
                className={`${styles.navLink} ${isActive(pathname, "/roadmap") ? styles.navLinkActive : ""}`}
                href="/roadmap"
              >
                Roadmap
              </Link>
              <Link
                className={`${styles.navLink} ${isActive(pathname, "/about") ? styles.navLinkActive : ""}`}
                href="/about"
              >
                About
              </Link>
            </nav>
          ) : null}
        </div>

        <div className={styles.right}>
          <SignedOut>
            <SignInButton>
              <button className={styles.button} type="button">
                Sign in
              </button>
            </SignInButton>
            <SignUpButton>
              <button className={`${styles.button} ${styles.buttonPrimary}`} type="button">
                Start free
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            {!inApp ? (
              <Link className={`${styles.button} ${styles.hideOnMobile}`} href="/app">
                Open app
              </Link>
            ) : null}
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

