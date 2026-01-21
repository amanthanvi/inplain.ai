import Link from "next/link";

import { COMPANY_CATALOG } from "../../lib/company-catalog";
import { CompanyDirectory } from "./company-directory";
import shell from "../marketing-shell.module.css";

export default function CompaniesPage() {
  return (
    <div className={shell.page}>
      <main className={shell.main}>
        <section className={shell.titleRow}>
          <div className={shell.kicker}>Companies</div>
          <h1 className={shell.title}>Start with a known policy URL.</h1>
          <p className={shell.lede}>
            Pick a company. We’ll help you track their public privacy policy and terms of service,
            and show diffs + citation-backed summaries when changes happen.
          </p>
          <div className={shell.linkRow}>
            <Link className={shell.pillLink} href="/signup">
              Start free →
            </Link>
            <Link className={shell.pillLink} href="/app/entities">
              Track a custom URL →
            </Link>
          </div>
        </section>

        <CompanyDirectory companies={COMPANY_CATALOG} />
      </main>
    </div>
  );
}

