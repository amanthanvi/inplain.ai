import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.kicker}>Inplain.ai</div>
          <h1>Track privacy policy changes — with diffs and citations.</h1>
          <p>
            Add public URLs. Inplain watches for meaningful updates, generates a readable diff, and
            produces grounded summaries that point to the exact changed text.
          </p>
          <div className={styles.ctas}>
            <Link className={styles.primary} href="/app">
              Open the app →
            </Link>
            <Link className={styles.secondary} href="/app/entities">
              Add a document →
            </Link>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Meaningful change detection</div>
            <div className={styles.cardBody}>
              Noisy boilerplate is ignored where possible. Changes create a Change Event you can
              review and export.
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Citation-backed summaries</div>
            <div className={styles.cardBody}>
              Every summary bullet includes citations pointing to a diff hunk (added/removed) to
              reduce hallucinations.
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Admin tooling</div>
            <div className={styles.cardBody}>
              Jobs, users, abuse signals, and LLM usage dashboards help keep the system healthy.
            </div>
          </div>
        </section>

        <section className={styles.disclaimer}>
          AI summaries are generated from detected text changes and are provided for informational
          purposes only. They are not legal advice.
        </section>
      </main>
    </div>
  );
}
