import Link from "next/link";
import { notFound } from "next/navigation";

import { SignedIn, SignedOut } from "@clerk/nextjs";

import { COMPANY_CATALOG, type CompanyCategory } from "../../lib/company-catalog";
import { InplainApiError, inplainFetchJson } from "../../lib/inplain-api";
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

  const companyName = company.name;
  const companyWebsiteUrl = company.websiteUrl;
  const companyDocuments = company.documents;

  async function watchCompany() {
    "use server";

    // eslint-disable-next-line @next/next/no-redirect-in-server-actions
    const { redirect } = await import("next/navigation");

    type EntityOut = { id: string };
    type EntityListItem = { id: string; name: string };
    type EntityListOut = { items: EntityListItem[]; nextCursor: string | null };

    type ApiErrorBody = {
      detail?: { error?: { code?: string; details?: Record<string, unknown> } };
    };

    function apiErrorInfo(err: InplainApiError): {
      code?: string;
      details?: Record<string, unknown>;
    } {
      const body = err.body as ApiErrorBody;
      return {
        code: body?.detail?.error?.code,
        details: body?.detail?.error?.details,
      };
    }

    let entityId: string | null = null;

    try {
      // Try to find an existing entity by name first (idempotent UX).
      let cursor: string | null = null;
      for (let page = 0; page < 5; page += 1) {
        const url: string = cursor
          ? `/v1/entities?limit=100&cursor=${encodeURIComponent(cursor)}`
          : "/v1/entities?limit=100";
        const list = await inplainFetchJson<EntityListOut>(url);
        const match = list.items.find((e) => e.name.toLowerCase() === companyName.toLowerCase());
        if (match) {
          entityId = match.id;
          break;
        }
        cursor = list.nextCursor;
        if (!cursor) break;
      }

      if (!entityId) {
        const created = await inplainFetchJson<EntityOut>("/v1/entities", {
          method: "POST",
          body: JSON.stringify({ name: companyName, websiteUrl: companyWebsiteUrl }),
        });
        entityId = created.id;
      }
    } catch (err) {
      if (err instanceof InplainApiError) {
        const info = apiErrorInfo(err);
        const existingEntityId = info.details?.entityId;
        if (err.status === 401) {
          // Session expired (or direct POST). Send them to auth.
          redirect("/sign-in");
        }
        if (err.status === 409 && typeof existingEntityId === "string") {
          entityId = existingEntityId;
        } else {
          throw err;
        }
      }
      throw err;
    }

    if (!entityId) {
      return;
    }

    // Create documents (best-effort; handle duplicates + limits gracefully).
    for (const doc of companyDocuments) {
      try {
        await inplainFetchJson(`/v1/entities/${entityId}/documents`, {
          method: "POST",
          body: JSON.stringify({
            url: doc.url,
            docType: doc.type,
            scheduleTier: "daily",
            fetchMode: "auto",
          }),
        });
      } catch (err) {
        if (err instanceof InplainApiError) {
          const info = apiErrorInfo(err);
          const code = info.code;
          const existingEntityId = info.details?.entityId;

          if (err.status === 403) {
            // Plan gate: send to billing.
            redirect("/app/settings?upgrade=1");
          }
          if (err.status === 409 && code === "DOCUMENT_ALREADY_EXISTS") {
            // Already tracked elsewhere; send user to the existing tracked entity.
            if (typeof existingEntityId === "string") {
              entityId = existingEntityId;
            }
            continue;
          }
        }
        throw err;
      }
    }

    redirect(`/app/entities/${entityId}`);
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
                <form action={watchCompany}>
                  <button className={`${styles.action} ${styles.actionPrimary}`} type="submit">
                    Watch changes
                  </button>
                </form>
              </SignedIn>
              <a
                className={styles.action}
                href={company.documents[0].url}
                target="_blank"
                rel="noreferrer"
              >
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
