import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <section className="card" style={{ padding: 26 }}>
        <p className="muted" style={{ margin: 0 }}>
          Privacy policies change quietly.
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.03em",
            margin: "10px 0 10px",
            fontSize: 44,
            lineHeight: 1.05,
          }}
        >
          Track what changed.
          <br />
          Understand why it matters.
        </h1>
        <p className="muted" style={{ maxWidth: 660, margin: "0 0 18px" }}>
          Inplain monitors public Privacy Policies and Terms of Service, generates readable diffs,
          and produces citation-backed summaries grounded in exact changed passages.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn btnPrimary" href="/companies">
            Browse companies
          </Link>
          <Link className="btn" href="/pricing">
            See pricing
          </Link>
        </div>
      </section>
    </main>
  );
}
