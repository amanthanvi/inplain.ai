export default function AboutPage() {
  return (
    <main>
      <header className="pageHeader">
        <div className="kicker">About</div>
        <h1 className="pageTitle">Policy changes, with receipts.</h1>
        <p className="pageLead">
          Inplain helps you notice when the rules change — and lets you verify every claim by
          jumping to the exact changed passage.
        </p>
      </header>

      <section className="grid2">
        <div className="card cardPad">
          <div className="cardTitle">What we do</div>
          <p className="muted" style={{ margin: "10px 0 0" }}>
            We monitor public Privacy Policies and Terms of Service from a curated directory,
            detect meaningful updates, store a readable diff, and generate summaries that include
            citations.
          </p>
        </div>

        <div className="card cardPad">
          <div className="cardTitle">Scope for this release</div>
          <p className="muted" style={{ margin: "10px 0 0" }}>
            We focus on curated-company tracking, in-app notifications, and auditable summaries.
            Custom URL monitoring and email digests are intentionally deferred.
          </p>
        </div>
      </section>

      <section className="section">
        <h2 className="sectionTitle">Design principles</h2>
        <div className="grid2">
          <div className="card cardPad">
            <div className="cardTitle">Citations first</div>
            <p className="muted" style={{ margin: "10px 0 0" }}>
              Summaries aren’t useful unless you can audit them. Every bullet links back to a
              stable diff hunk.
            </p>
          </div>
          <div className="card cardPad">
            <div className="cardTitle">Respect the web</div>
            <p className="muted" style={{ margin: "10px 0 0" }}>
              We respect robots.txt, rate-limit by origin, and block SSRF vectors. This is policy
              monitoring — not scraping-as-a-service.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
