'use strict';

var zod = require('zod');

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var SnapshotMetaSchema = zod.z.object({
  id: zod.z.string().uuid(),
  slug: zod.z.string().min(1),
  url: zod.z.string().url(),
  capturedAt: zod.z.string().datetime(),
  blobKey: zod.z.string().min(1),
  contentHash: zod.z.string().regex(/^[a-f0-9]{64}$/),
  contentLength: zod.z.number().int().positive(),
  contentType: zod.z.enum(["html", "pdf", "text"]),
  headers: zod.z.record(zod.z.string()),
  status: zod.z.enum(["pending", "processed", "failed"]),
  error: zod.z.string().optional()
});
var DiffMetaSchema = zod.z.object({
  id: zod.z.string().uuid(),
  slug: zod.z.string().min(1),
  fromSnapshotId: zod.z.string().uuid(),
  toSnapshotId: zod.z.string().uuid(),
  createdAt: zod.z.string().datetime(),
  changeCount: zod.z.number().int().nonnegative(),
  changeType: zod.z.enum(["minor", "moderate", "major"]),
  additions: zod.z.number().int().nonnegative(),
  deletions: zod.z.number().int().nonnegative(),
  diffBlobKey: zod.z.string().min(1),
  summaryId: zod.z.string().uuid().optional()
});
var SummarySchema = zod.z.object({
  id: zod.z.string().uuid(),
  diffId: zod.z.string().uuid(),
  createdAt: zod.z.string().datetime(),
  model: zod.z.string().default("claude-4-opus"),
  prompt: zod.z.string().min(1),
  summary: zod.z.string().min(1),
  highlights: zod.z.array(zod.z.string()),
  riskLevel: zod.z.enum(["low", "medium", "high"]),
  categories: zod.z.array(zod.z.enum([
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
  tokensUsed: zod.z.number().int().positive(),
  cached: zod.z.boolean().default(false)
});
var CompanySchema = zod.z.object({
  slug: zod.z.string().min(1),
  name: zod.z.string().min(1),
  url: zod.z.string().url(),
  category: zod.z.string().optional(),
  checkInterval: zod.z.number().int().positive().default(86400),
  lastChecked: zod.z.string().datetime().optional(),
  active: zod.z.boolean().default(true)
});
var CrawlJobSchema = zod.z.object({
  id: zod.z.string().uuid(),
  slug: zod.z.string().min(1),
  url: zod.z.string().url(),
  status: zod.z.enum(["pending", "running", "completed", "failed"]),
  createdAt: zod.z.string().datetime(),
  startedAt: zod.z.string().datetime().optional(),
  completedAt: zod.z.string().datetime().optional(),
  retries: zod.z.number().int().nonnegative().default(0),
  error: zod.z.string().optional()
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

exports.CHANGE_TYPES = CHANGE_TYPES;
exports.CompanySchema = CompanySchema;
exports.CrawlJobSchema = CrawlJobSchema;
exports.DiffMetaSchema = DiffMetaSchema;
exports.RISK_LEVELS = RISK_LEVELS;
exports.SnapshotMetaSchema = SnapshotMetaSchema;
exports.SummarySchema = SummarySchema;
exports.WATCHED_COMPANIES = WATCHED_COMPANIES;
exports.calculateChangeType = calculateChangeType;
exports.extractDomain = extractDomain;
exports.formatDuration = formatDuration;
exports.formatTimestamp = formatTimestamp;
exports.getTimeDiff = getTimeDiff;
exports.hashContent = hashContent;
exports.normalizeUrl = normalizeUrl;
exports.parseTimestamp = parseTimestamp;
exports.slugify = slugify;
exports.truncate = truncate;
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map