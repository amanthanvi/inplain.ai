"use client";

import { useMemo, useState } from "react";

import type { CompanyCatalogItem } from "../../lib/company-catalog";

import styles from "./tabs.module.css";

type TabKey = "overview" | "current" | "changes" | "versions" | "timeline" | "analysis";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "current", label: "Current Policy" },
  { key: "changes", label: "Changes" },
  { key: "versions", label: "Versions" },
  { key: "timeline", label: "Timeline" },
  { key: "analysis", label: "AI Analysis" },
];

function pillLabel(docType: string): string {
  switch (docType) {
    case "privacy":
      return "privacy";
    case "tos":
      return "terms";
    case "cookie":
      return "cookie";
    default:
      return "policy";
  }
}

export function CompanyTabs({ company }: { company: CompanyCatalogItem }) {
  const [active, setActive] = useState<TabKey>("overview");

  const content = useMemo(() => {
    switch (active) {
      case "overview":
        return (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Policies</div>
            <div className={styles.policyList}>
              {company.documents.map((d) => (
                <a
                  key={d.url}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.policyItem}
                >
                  <div className={styles.policyMeta}>
                    <div className={styles.policyTitle}>{d.title}</div>
                    <div className={styles.policyUrl}>{d.url}</div>
                  </div>
                  <div className={styles.pill}>{pillLabel(d.type)}</div>
                </a>
              ))}
            </div>

            <div className={styles.empty}>
              This is a public preview page. When you watch a company, Inplain will create a tracked
              entity in your dashboard and start capturing snapshots on a schedule.
            </div>
          </div>
        );
      case "current":
        return (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Current policy snapshot</div>
            <div className={styles.empty}>
              No snapshot available yet. Once you watch this company, we’ll capture the first
              snapshot during the initial check.
            </div>
          </div>
        );
      case "changes":
        return (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Recent changes</div>
            <div className={styles.empty}>
              No change history available yet. After the first snapshot, changes will appear here
              whenever we detect meaningful updates.
            </div>
          </div>
        );
      case "versions":
        return (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Versions</div>
            <div className={styles.empty}>
              Version history will appear after snapshots are captured. You’ll be able to compare
              two versions and export the diff.
            </div>
          </div>
        );
      case "timeline":
        return (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Timeline</div>
            <div className={styles.empty}>
              Timeline will show every scan, snapshot, and meaningful change event.
            </div>
          </div>
        );
      case "analysis":
        return (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>AI analysis</div>
            <p className={styles.muted}>
              AI summaries are generated from detected changes and include citations to the exact
              changed text. You can always inspect the underlying diff.
            </p>
            <div className={styles.empty}>No analysis yet.</div>
          </div>
        );
      default:
        return null;
    }
  }, [active, company.documents]);

  return (
    <section className={styles.tabsShell}>
      <div className={styles.tabRow} aria-label="Company sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.tab} ${active === t.key ? styles.tabActive : ""}`}
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {content}
    </section>
  );
}

