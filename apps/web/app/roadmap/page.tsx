import Link from "next/link";

import styles from "../marketing-shell.module.css";

export default function RoadmapPage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.titleRow}>
          <div className={styles.kicker}>Roadmap</div>
          <h1 className={styles.title}>v0.1.0: practical tracking that ships.</h1>
          <p className={styles.lede}>
            We’re focused on a stable, production-ready core: tracking, diffs, citation-backed
            summaries, and simple onboarding. Keep it small, reliable, and fast.
          </p>
          <div className={styles.linkRow}>
            <Link className={styles.pillLink} href="/companies">
              Browse companies →
            </Link>
            <Link className={styles.pillLink} href="/app/settings">
              Billing & limits →
            </Link>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Public companies directory</div>
            <div className={styles.cardBody}>
              A curated list of companies with known policy URLs, plus search and filtering.
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Watch flow</div>
            <div className={styles.cardBody}>
              One click creates tracking in your dashboard: company entity + documents, plus an
              initial snapshot job.
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Current policy & versions</div>
            <div className={styles.cardBody}>
              Show the latest snapshot, a list of historical versions, and a simple compare view.
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Ops hygiene</div>
            <div className={styles.cardBody}>
              Backups, migrations on boot, and practical runbooks. Observability stays lean (Railway
              logs first).
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

