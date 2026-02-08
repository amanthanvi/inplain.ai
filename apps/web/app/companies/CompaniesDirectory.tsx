"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { EntityOut } from "@/lib/internal-api";

function prettyCategory(category: string) {
  return category.replaceAll("_", " ");
}

export function CompaniesDirectory({ entities }: { entities: EntityOut[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of entities) set.add(e.category);
    return ["all", ...Array.from(set).sort()];
  }, [entities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entities
      .filter((e) => (category === "all" ? true : e.category === category))
      .filter((e) => {
        if (!q) return true;
        return (
          e.name.toLowerCase().includes(q) ||
          e.slug.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
        );
      });
  }, [entities, query, category]);

  return (
    <main>
      <header className="pageHeader">
        <div className="kicker">Directory</div>
        <div className="pageTop">
          <div>
            <h1 className="pageTitle">Companies</h1>
            <p className="pageLead">Curated directory. Watch a company to track policy changes.</p>
          </div>

          <div className="pageActions">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search companies…"
              className="input"
              aria-label="Search companies"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="select"
              aria-label="Filter by category"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All categories" : prettyCategory(c)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="cardsGrid">
        {filtered.map((e) => (
          <Link key={e.id} className="companyCard" href={`/companies/${e.slug}`}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="companyName">{e.name}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {prettyCategory(e.category)}
                </div>
              </div>
              <span className="pill">View</span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card cardPad" style={{ marginTop: 18 }}>
          <div className="cardTitle">No results</div>
          <div className="muted" style={{ marginTop: 10 }}>
            Try a different search term or category.
          </div>
        </div>
      ) : null}
    </main>
  );
}
