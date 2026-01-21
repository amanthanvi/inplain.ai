"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { CompanyCatalogItem, CompanyCategory } from "../../lib/company-catalog";

import styles from "./companies.module.css";

const CATEGORY_LABEL: Record<CompanyCategory, string> = {
  technology: "Technology",
  social: "Social",
  ecommerce: "E-commerce",
  finance: "Finance",
  productivity: "Productivity",
  other: "Other",
};

function matchesQuery(company: CompanyCatalogItem, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    company.name.toLowerCase().includes(q) ||
    company.description.toLowerCase().includes(q) ||
    company.slug.toLowerCase().includes(q)
  );
}

export function CompanyDirectory({ companies }: { companies: CompanyCatalogItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CompanyCategory | "all">("all");
  const [view, setView] = useState<"grid" | "list">("grid");

  const filtered = useMemo(() => {
    return companies
      .filter((c) => (category === "all" ? true : c.category === category))
      .filter((c) => matchesQuery(c, query))
      .sort((a, b) => (b.stats?.watchers ?? 0) - (a.stats?.watchers ?? 0));
  }, [companies, category, query]);

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <span style={{ opacity: 0.75, fontSize: 12 }}>Search</span>
          <input
            className={styles.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies…"
            aria-label="Search companies"
          />
        </div>
        <select
          className={styles.select}
          value={category}
          onChange={(e) => setCategory(e.target.value as CompanyCategory | "all")}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <div className={styles.viewToggle} role="group" aria-label="View">
          <button
            type="button"
            className={`${styles.viewButton} ${view === "grid" ? styles.viewButtonActive : ""}`}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
          <button
            type="button"
            className={`${styles.viewButton} ${view === "list" ? styles.viewButtonActive : ""}`}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
      </div>

      <div className={styles.meta}>
        <span>{filtered.length} companies</span>
        <span>·</span>
        <span>Curated policy URLs</span>
      </div>

      {filtered.length ? (
        <div className={`${styles.list} ${view === "list" ? styles.listCompact : ""}`}>
          {filtered.map((c) => (
            <Link key={c.slug} href={`/${c.slug}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div className={styles.name}>{c.name}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{c.websiteUrl}</div>
                </div>
                <div className={styles.badge}>{CATEGORY_LABEL[c.category]}</div>
              </div>
              <div className={styles.desc}>{c.description}</div>
              <div className={styles.statsRow}>
                <span>{c.documents.length} policies</span>
                {c.stats ? (
                  <>
                    <span>·</span>
                    <span>{c.stats.watchers} watchers</span>
                    <span>·</span>
                    <span>risk {c.stats.risk}</span>
                  </>
                ) : null}
              </div>
              <div className={styles.actions} aria-hidden="true">
                <span className={`${styles.action} ${styles.primaryAction}`}>View →</span>
                <span className={styles.action}>Watch changes</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          No matches. Try a different search or clear the category filter.
        </div>
      )}
    </div>
  );
}
