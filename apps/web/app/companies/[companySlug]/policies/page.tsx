import Link from "next/link";
import { notFound } from "next/navigation";

import { COMPANY_CATALOG, type CompanyCategory } from "../../../../lib/company-catalog";

import shell from "../../../marketing-shell.module.css";

const CATEGORY_LABEL: Record<CompanyCategory, string> = {
  technology: "Technology",
  social: "Social",
  ecommerce: "E-commerce",
  finance: "Finance",
  productivity: "Productivity",
  other: "Other",
};

export default async function CompanyPoliciesPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const company = COMPANY_CATALOG.find((c) => c.slug === companySlug);
  if (!company) {
    notFound();
  }

  return (
    <div className={shell.page}>
      <main className={shell.main}>
        <section className={shell.titleRow}>
          <div className={shell.kicker}>Policies</div>
          <h1 className={shell.title}>{company.name}</h1>
          <p className={shell.lede}>
            Standard policy URLs we track for {company.name}. Start watching to capture snapshots,
            diffs, and citation-backed summaries.
          </p>
          <div className={shell.linkRow}>
            <Link className={shell.pillLink} href={`/${company.slug}`}>
              ← Company overview
            </Link>
            <Link className={shell.pillLink} href="/signup">
              Start free →
            </Link>
          </div>
        </section>

        <section className={shell.grid}>
          <div className={shell.card}>
            <div className={shell.cardTitle}>Category</div>
            <div className={shell.cardBody}>{CATEGORY_LABEL[company.category]}</div>
          </div>
          <div className={shell.card}>
            <div className={shell.cardTitle}>Website</div>
            <div className={shell.cardBody}>{company.websiteUrl}</div>
          </div>
        </section>

        <section className={shell.panel}>
          <div className={shell.cardTitle}>Tracked policies</div>
          <div style={{ display: "grid", gap: 10 }}>
            {company.documents.map((d) => (
              <a
                key={d.url}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "grid",
                  gap: 4,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 650 }}>{d.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{d.type}</div>
                </div>
                <div style={{ fontSize: 12, opacity: 0.7, wordBreak: "break-word" }}>{d.url}</div>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

