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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: "var(--font-display)" }}>Companies</h1>
          <p className="muted" style={{ margin: "8px 0 0" }}>
            Curated directory. Watch a company to track policy changes.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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

      <div style={{ height: 18 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
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
        <div className="card" style={{ padding: 18, marginTop: 18 }}>
          <div style={{ fontWeight: 600 }}>No results</div>
          <div className="muted" style={{ marginTop: 6 }}>
            Try a different search term or category.
          </div>
        </div>
      ) : null}
    </main>
  );
}

