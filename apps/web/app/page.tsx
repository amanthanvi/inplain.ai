import Link from "next/link";

import { COMPANY_CATALOG } from "../lib/company-catalog";
import styles from "./page.module.css";

export default function Home() {
  const popular = [...COMPANY_CATALOG]
    .sort((a, b) => (b.stats?.watchers ?? 0) - (a.stats?.watchers ?? 0))
    .slice(0, 5);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroBadge}>
            <span className={styles.dot} aria-hidden="true" />
            Live monitoring active
          </div>
          <div className={styles.kicker}>Inplain.ai</div>
          <h1>
            Privacy policies
            <span className={styles.heroAccent}> made simple.</span>
          </h1>
          <p>
            Stop missing critical policy updates. Inplain.ai watches public privacy policies and
            terms of service, generates readable diffs, and explains what changed — with citations
            to the exact passages.
          </p>
          <div className={styles.ctas}>
            <Link className={styles.primary} href="/signup">
              Start free
            </Link>
            <Link className={styles.secondary} href="/companies">
              Browse companies
            </Link>
            <Link className={styles.tertiary} href="/app">
              Open app
            </Link>
          </div>
          <div className={styles.heroMeta}>
            <span>No credit card required</span>
            <span aria-hidden="true">·</span>
            <span>Cancel anytime</span>
            <span aria-hidden="true">·</span>
            <span>Citations included</span>
          </div>
        </section>

        <section className={styles.problem}>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>Privacy policies are broken</h2>
            <p className={styles.sectionLede}>And companies are counting on you not to notice.</p>
          </div>
          <div className={styles.problemGrid}>
            <div className={styles.problemCard}>
              <div className={styles.problemStat}>67%</div>
              <div className={styles.problemLabel}>Change without notice</div>
              <div className={styles.problemBody}>
                Most companies update policies quietly — often expanding data collection or
                third-party sharing.
              </div>
            </div>
            <div className={styles.problemCard}>
              <div className={styles.problemStat}>20,000+</div>
              <div className={styles.problemLabel}>Words on average</div>
              <div className={styles.problemBody}>
                Legal text is long, dense, and hard to compare over time without a diff.
              </div>
            </div>
            <div className={styles.problemCard}>
              <div className={styles.problemStat}>76 days</div>
              <div className={styles.problemLabel}>To read everything</div>
              <div className={styles.problemBody}>
                Reading every policy you touch would take months every year. Automation matters.
              </div>
            </div>
          </div>
        </section>

        <section className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statValue}>{COMPANY_CATALOG.length}+</div>
            <div className={styles.statLabel}>Curated companies</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>24/7</div>
            <div className={styles.statLabel}>Monitoring</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statValue}>Diffs</div>
            <div className={styles.statLabel}>With citations</div>
          </div>
        </section>

        <section className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Change detection that filters noise</div>
            <div className={styles.cardBody}>
              Noisy boilerplate is ignored where possible. Changes create a Change Event you can
              review and export.
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>AI summaries grounded in diffs</div>
            <div className={styles.cardBody}>
              Every summary bullet includes citations pointing to a diff hunk (added/removed) to
              reduce hallucinations.
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Exportable history</div>
            <div className={styles.cardBody}>
              Keep an auditable trail: snapshots, diffs, summaries, and metadata you can export for
              review.
            </div>
          </div>
        </section>

        <section className={styles.how}>
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>How it works</h2>
            <p className={styles.sectionLede}>Get set up in minutes.</p>
          </div>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <div className={styles.stepNum}>1</div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>Pick a company to watch</div>
                <div className={styles.stepText}>
                  Start from our curated directory and choose what matters to you.
                </div>
              </div>
            </li>
            <li className={styles.step}>
              <div className={styles.stepNum}>2</div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>We monitor on a schedule</div>
                <div className={styles.stepText}>
                  Inplain fetches and normalizes the policy, then stores snapshots over time.
                </div>
              </div>
            </li>
            <li className={styles.step}>
              <div className={styles.stepNum}>3</div>
              <div className={styles.stepBody}>
                <div className={styles.stepTitle}>You get diffs + plain-English analysis</div>
                <div className={styles.stepText}>
                  When meaningful changes happen, you see a readable diff and a cited summary.
                </div>
              </div>
            </li>
          </ol>
        </section>

        <section className={styles.demo} id="demo">
          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>Popular companies</h2>
            <p className={styles.sectionLede}>Start with a known policy URL.</p>
          </div>
          <div className={styles.popularRow}>
            {popular.map((c) => (
              <Link key={c.slug} className={styles.popularCard} href={`/${c.slug}`}>
                <div className={styles.popularTop}>
                  <div className={styles.popularName}>{c.name}</div>
                  <div className={styles.popularBadge}>{c.category}</div>
                </div>
                <div className={styles.popularUrl}>{c.websiteUrl}</div>
                <div className={styles.popularMeta}>
                  {c.documents.length} policies{c.stats ? ` · ${c.stats.watchers} watchers` : ""}
                </div>
              </Link>
            ))}
          </div>
          <div className={styles.linkRow}>
            <Link className={styles.secondary} href="/companies">
              View all companies →
            </Link>
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
