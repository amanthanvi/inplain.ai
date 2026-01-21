import Link from "next/link";
import { notFound } from "next/navigation";

import { SignedIn, SignedOut } from "@clerk/nextjs";

import { COMPANY_CATALOG, type CompanyCategory } from "../../lib/company-catalog";
import { CompanyTabs } from "./tabs";

import styles from "./company.module.css";

const CATEGORY_LABEL: Record<CompanyCategory, string> = {
  technology: "Technology",
  social: "Social",
  ecommerce: "E-commerce",
  finance: "Finance",
  productivity: "Productivity",
  other: "Other",
};

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = COMPANY_CATALOG.find((c) => c.slug === companySlug);
  if (!company) {
    notFound();
  }

  const privacyScore = company.stats?.privacyScore ?? 0;
  const riskLabel = company.stats?.risk ?? "low";

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <div className={styles.crumbs}>
          <Link href="/companies" style={{ textDecoration: "underline" }}>
            Companies
          </Link>{" "}
          / {company.name}
        </div>

        <section className={styles.hero}>
          <div className={styles.heroTop}>
            <div style={{ display: "grid", gap: 10, minWidth: 260 }}>
              <div>
                <h1 className={styles.heroTitle}>{company.name}</h1>
                <div className={styles.tagRow}>
                  <span className={styles.tag}>{CATEGORY_LABEL[company.category]}</span>
                  <span className={styles.tag}>{company.documents.length} policies</span>
                </div>
              </div>
              <p className={styles.lede}>{company.description}</p>
              <div className={styles.heroMeta}>
                <span>Website: {company.websiteUrl}</span>
                {company.stats ? (
                  <>
                    <span>·</span>
                    <span>{company.stats.watchers} watchers</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className={styles.actions}>
              <SignedOut>
                <Link className={`${styles.action} ${styles.actionPrimary}`} href="/signup">
                  Watch changes
                </Link>
              </SignedOut>
              <SignedIn>
                <Link className={`${styles.action} ${styles.actionPrimary}`} href="/app/entities">
                  Track in app
                </Link>
              </SignedIn>
              <a className={styles.action} href={company.documents[0]?.url} target="_blank" rel="noreferrer">
                View policy
              </a>
            </div>
          </div>
        </section>

        <section className={styles.metrics}>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Privacy Score</div>
            <div className={styles.metricValue}>{privacyScore}</div>
            <div className={styles.metricSub}>Placeholder score</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Risk Level</div>
            <div className={styles.metricValue}>{riskLabel}</div>
            <div className={styles.metricSub}>Based on detected changes</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>Compliance</div>
            <div className={styles.metricValue}>—</div>
            <div className={styles.metricSub}>Coming soon</div>
          </div>
          <div className={styles.metric}>
            <div className={styles.metricLabel}>AI Insights</div>
            <div className={styles.metricValue}>—</div>
            <div className={styles.metricSub}>Coming soon</div>
          </div>
        </section>

        <CompanyTabs company={company} />
      </main>
    </div>
  );
}

