import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="heroGrid">
          <div className="heroCopy">
            <div className="kicker">Policy changes shouldn’t hide in legal pages.</div>
            <h1 className="heroTitle">
              Track what changed.
              <br />
              Understand why it matters.
            </h1>
            <p className="heroLead">
              Inplain monitors public policy documents from a curated directory, builds readable
              diffs, and generates citation-backed summaries grounded in exact changed text.
            </p>

            <div className="heroCtas">
              <Link className="btn btnPrimary" href="/companies">
                Browse companies
              </Link>
              <Link className="btn" href="/pricing">
                See pricing
              </Link>
            </div>

            <div className="heroBadges">
              <span className="badge">32-company curated catalog</span>
              <span className="badge">Robots-respecting</span>
              <span className="badge">Citations you can click</span>
            </div>
          </div>

          <div className="heroPreview">
            <div className="previewCard">
              <div className="previewHeader">
                <div style={{ minWidth: 0 }}>
                  <div className="previewLabel">Example change</div>
                  <div className="previewTitle">Acme — Privacy Policy</div>
                </div>
                <span className="pill">meaningful</span>
              </div>

              <div className="previewBody">
                <div className="previewSummary">
                  <div className="previewSectionLabel">What changed</div>
                  <ul className="previewBullets">
                    <li>
                      Added a clearer definition of “service providers”.
                      <span className="previewCitations">
                        <span className="citation">H2</span>
                      </span>
                    </li>
                    <li>
                      Expanded sharing reasons for “security” and “fraud prevention”.
                      <span className="previewCitations">
                        <span className="citation">H3</span>
                        <span className="citation">H4</span>
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="previewDiff">
                  <article className="hunk">
                    <div className="hunkHeader">
                      <span className="pill">H2</span>
                    </div>
                    <div className="hunkBody">
                      <div className="diffRemoved">
                        We may share information with third parties to provide services.
                      </div>
                      <div className="diffAdded">
                        We share information with service providers who process data on our behalf
                        to operate the Service.
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="sectionTitleRow">
          <h2 className="sectionTitle">How it works</h2>
          <p className="sectionLead muted">
            You get a timeline of change events, a readable diff, and a summary you can audit.
          </p>
        </div>

        <div className="stepGrid">
          <div className="stepCard">
            <div className="stepIndex">01</div>
            <div className="stepTitle">Watch a company</div>
            <div className="muted">Choose from the curated directory (Privacy / ToS / Cookies).</div>
          </div>
          <div className="stepCard">
            <div className="stepIndex">02</div>
            <div className="stepTitle">We check on schedule</div>
            <div className="muted">
              Fetch with ETag/Last-Modified, respect robots.txt, render when needed.
            </div>
          </div>
          <div className="stepCard">
            <div className="stepIndex">03</div>
            <div className="stepTitle">You review the diff</div>
            <div className="muted">
              Section-first hunks with unified and side-by-side views.
            </div>
          </div>
          <div className="stepCard">
            <div className="stepIndex">04</div>
            <div className="stepTitle">Read the “why”</div>
            <div className="muted">
              Summaries include citations that jump to the exact changed passage.
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="ctaCard">
          <div>
            <div className="kicker">Start with the directory</div>
            <div className="ctaTitle">Pick a company you already use.</div>
            <div className="muted" style={{ marginTop: 8 }}>
              Watch it once, then come back when you get a change event.
            </div>
          </div>
          <div className="ctaButtons">
            <Link className="btn btnPrimary" href="/companies">
              Browse companies
            </Link>
            <Link className="btn" href="/dashboard">
              Open dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
