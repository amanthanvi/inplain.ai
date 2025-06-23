import { z } from 'zod';

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var SnapshotMetaSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  url: z.string().url(),
  capturedAt: z.string().datetime(),
  blobKey: z.string().min(1),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  contentLength: z.number().int().positive(),
  contentType: z.enum(["html", "pdf", "text"]),
  headers: z.record(z.string()),
  status: z.enum(["pending", "processed", "failed"]),
  error: z.string().optional()
});
var DiffMetaSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  fromSnapshotId: z.string().uuid(),
  toSnapshotId: z.string().uuid(),
  createdAt: z.string().datetime(),
  changeCount: z.number().int().nonnegative(),
  changeType: z.enum(["minor", "moderate", "major"]),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  diffBlobKey: z.string().min(1),
  summaryId: z.string().uuid().optional()
});
var SummarySchema = z.object({
  id: z.string().uuid(),
  diffId: z.string().uuid(),
  createdAt: z.string().datetime(),
  model: z.string().default("claude-4-opus"),
  prompt: z.string().min(1),
  summary: z.string().min(1),
  highlights: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
  categories: z.array(z.enum([
    "data_collection",
    "data_sharing",
    "data_retention",
    "user_rights",
    "security",
    "cookies",
    "third_parties",
    "children",
    "other"
  ])),
  tokensUsed: z.number().int().positive(),
  cached: z.boolean().default(false)
});
var CompanySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  category: z.string().optional(),
  checkInterval: z.number().int().positive().default(86400),
  lastChecked: z.string().datetime().optional(),
  active: z.boolean().default(true)
});
var CrawlJobSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  url: z.string().url(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  retries: z.number().int().nonnegative().default(0),
  error: z.string().optional()
});

// src/utils.ts
function slugify(text) {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
function formatTimestamp(date = /* @__PURE__ */ new Date()) {
  return date.toISOString();
}
function parseTimestamp(timestamp) {
  return new Date(timestamp);
}
function getTimeDiff(from, to = /* @__PURE__ */ new Date()) {
  const fromDate = typeof from === "string" ? parseTimestamp(from) : from;
  const toDate = typeof to === "string" ? parseTimestamp(to) : to;
  return toDate.getTime() - fromDate.getTime();
}
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
function hashContent(content) {
  const crypto = globalThis.crypto || __require("crypto");
  if (typeof crypto.subtle !== "undefined") {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(content)).then((buffer) => {
      return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }).catch(() => fallbackHash(content));
  }
  return fallbackHash(content);
}
function fallbackHash(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, "0");
}
function truncate(text, maxLength, suffix = "...") {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    if (parsed.pathname === "/") {
      parsed.pathname = "";
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}
var RISK_LEVELS = {
  low: { label: "Low Risk", color: "green" },
  medium: { label: "Medium Risk", color: "yellow" },
  high: { label: "High Risk", color: "red" }
};
var CHANGE_TYPES = {
  minor: { label: "Minor Changes", threshold: 0.05 },
  moderate: { label: "Moderate Changes", threshold: 0.15 },
  major: { label: "Major Changes", threshold: 0.3 }
};
function calculateChangeType(additions, deletions, total) {
  if (total === 0) return "minor";
  const changeRatio = (additions + deletions) / total;
  if (changeRatio >= CHANGE_TYPES.major.threshold) return "major";
  if (changeRatio >= CHANGE_TYPES.moderate.threshold) return "moderate";
  return "minor";
}

// src/constants.ts
var WATCHED_COMPANIES = [
  {
    slug: "google",
    name: "Google",
    url: "https://policies.google.com/privacy",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/privacy/policy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "amazon",
    name: "Amazon",
    url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=468496",
    category: "e-commerce",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "microsoft",
    name: "Microsoft",
    url: "https://privacy.microsoft.com/en-us/privacystatement",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "apple",
    name: "Apple",
    url: "https://www.apple.com/legal/privacy/",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "twitter",
    name: "Twitter",
    url: "https://twitter.com/en/privacy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "netflix",
    name: "Netflix",
    url: "https://help.netflix.com/legal/privacy",
    category: "entertainment",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "spotify",
    name: "Spotify",
    url: "https://www.spotify.com/us/legal/privacy-policy/",
    category: "entertainment",
    active: true,
    checkInterval: 86400
  }
];

export { CHANGE_TYPES, CompanySchema, CrawlJobSchema, DiffMetaSchema, RISK_LEVELS, SnapshotMetaSchema, SummarySchema, WATCHED_COMPANIES, calculateChangeType, extractDomain, formatDuration, formatTimestamp, getTimeDiff, hashContent, normalizeUrl, parseTimestamp, slugify, truncate };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map