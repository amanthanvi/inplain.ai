import Link from "next/link";

import { COMPANY_CATALOG } from "../../lib/company-catalog";
import styles from "../marketing-shell.module.css";

export default function AboutPage() {
  const companiesTracked = COMPANY_CATALOG.length;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.titleRow}>
          <div className={styles.kicker}>About</div>
          <h1 className={styles.title}>Privacy policies made simple.</h1>
          <p className={styles.lede}>
            Inplain.ai monitors public privacy policies and terms of service over time. When
            something changes, we generate a readable diff and explain it in plain English — with
            citations to the exact passages so you can verify every claim.
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
            <div className={styles.cardTitle}>Companies tracked</div>
            <div className={styles.cardBody}>{companiesTracked}+</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Monitoring</div>
            <div className={styles.cardBody}>Every 24h (default)</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Diffs</div>
            <div className={styles.cardBody}>Readable, exportable</div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>AI analysis</div>
            <div className={styles.cardBody}>Grounded by citations</div>
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
          <div className={styles.card}>
            <div className={styles.cardTitle}>Your data stays yours</div>
            <div className={styles.cardBody}>
              Export your tracked history any time. Inplain is designed for auditability and
              verification.
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Privacy-first posture</div>
            <div className={styles.cardBody}>
              We don’t need invasive tracking to do our job. The product is built around monitoring
              public URLs and showing the underlying evidence.
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
