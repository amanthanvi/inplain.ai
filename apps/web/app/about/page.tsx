import Link from "next/link";

import styles from "../marketing-shell.module.css";

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.titleRow}>
          <div className={styles.kicker}>About</div>
          <h1 className={styles.title}>Understand what changed — and why it matters.</h1>
          <p className={styles.lede}>
            Inplain.ai tracks public privacy policies and terms of service over time. When something
            changes, we generate a readable diff and explain it with citations to the exact
            passages, so you can verify every claim.
          </p>
          <div className={styles.linkRow}>
            <Link className={styles.pillLink} href="/companies">
              Browse companies →
            </Link>
            <Link className={styles.pillLink} href="/app">
              Open the app →
            </Link>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Grounded by design</div>
            <div className={styles.cardBody}>
              AI summaries are generated from detected text changes and cite the specific hunks that
              changed. No citations, no claim.
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Public pages only</div>
            <div className={styles.cardBody}>
              v0.1.0 focuses on public URLs. We respect robots.txt by default and apply rate limits
              to avoid hammering hosts.
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.cardTitle}>Not legal advice</div>
          <div className={styles.cardBody}>
            Inplain.ai is for informational purposes only and does not provide legal advice. Always
            consult qualified counsel for legal decisions.
          </div>
        </section>
      </main>
    </div>
  );
}
