import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div>
          <div className="brand" style={{ fontSize: 18 }}>
            inplain
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Track policy changes. Audit every claim.
          </div>
        </div>

        <div className="footerLinks">
          <Link href="/companies">Companies</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <a href="https://github.com/amanthanvi/inplain.ai" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>

        <div className="muted" style={{ fontSize: 12 }}>
          © {new Date().getFullYear()} Inplain.ai · Informational only
        </div>
      </div>
    </footer>
  );
}
