import Link from "next/link";

import { COMPANY_CATALOG } from "../../lib/company-catalog";
import { CompanyDirectory } from "./company-directory";
import shell from "../marketing-shell.module.css";
import hero from "./companies-page.module.css";

export default function CompaniesPage() {
  const total = COMPANY_CATALOG.length;
  const highRisk = COMPANY_CATALOG.filter((c) => c.stats?.risk === "high").length;
  const avgScore =
    total === 0
      ? 0
      : Math.round(
          COMPANY_CATALOG.reduce((acc, c) => acc + (c.stats?.privacyScore ?? 0), 0) / total,
        );

  return (
    <div className={shell.page}>
      <main className={shell.main}>
        <section className={hero.hero}>
          <div className={shell.kicker}>Companies</div>
          <div className={hero.heroTop}>
            <div>
              <h1 className={hero.heroTitle}>Tracked companies</h1>
              <p className={hero.heroLede}>
                Monitoring {total} companies for privacy policy changes with citation-backed
                analysis. Start with a known policy URL — or track a custom page in your dashboard.
              </p>
            </div>
            <div className={hero.heroActions}>
              <Link className={`${hero.heroButton} ${hero.heroButtonPrimary}`} href="/signup">
                Set up alerts
              </Link>
              <Link className={hero.heroButton} href="/app/entities">
                Track a custom URL
              </Link>
            </div>
          </div>

          <div className={hero.stats}>
            <div className={hero.statCard}>
              <div className={hero.statLabel}>Active monitoring</div>
              <div className={hero.statValue}>{total}</div>
            </div>
            <div className={hero.statCard}>
              <div className={hero.statLabel}>Recent changes</div>
              <div className={hero.statValue}>0</div>
            </div>
            <div className={hero.statCard}>
              <div className={hero.statLabel}>High risk</div>
              <div className={hero.statValue}>{highRisk}</div>
            </div>
            <div className={hero.statCard}>
              <div className={hero.statLabel}>Average score</div>
              <div className={hero.statValue}>{avgScore || "—"}</div>
            </div>
          </div>
        </section>

        <CompanyDirectory companies={COMPANY_CATALOG} />
      </main>
    </div>
  );
}
