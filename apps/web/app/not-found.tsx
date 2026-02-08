import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <header className="pageHeader">
        <div className="kicker">404</div>
        <h1 className="pageTitle">Page not found.</h1>
        <p className="pageLead">
          The page you’re looking for doesn’t exist, or it moved.
        </p>
      </header>

      <div className="card cardPad">
        <div className="cardTitle">Where to go</div>
        <div className="pageActions" style={{ marginTop: 12 }}>
          <Link className="btn btnPrimary" href="/">
            Home
          </Link>
          <Link className="btn" href="/companies">
            Browse companies
          </Link>
        </div>
      </div>
    </main>
  );
}

