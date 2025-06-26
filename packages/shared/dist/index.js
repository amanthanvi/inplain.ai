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
  // Technology
  {
    slug: "google",
    name: "Google",
    url: "https://policies.google.com/privacy",
    category: "technology",
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
    slug: "meta",
    name: "Meta",
    url: "https://www.facebook.com/privacy/policy",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "openai",
    name: "OpenAI",
    url: "https://openai.com/policies/privacy-policy",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    url: "https://www.anthropic.com/privacy",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "adobe",
    name: "Adobe",
    url: "https://www.adobe.com/privacy/policy.html",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "oracle",
    name: "Oracle",
    url: "https://www.oracle.com/legal/privacy/privacy-policy.html",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "salesforce",
    name: "Salesforce",
    url: "https://www.salesforce.com/company/privacy/",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "github",
    name: "GitHub",
    url: "https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "nvidia",
    name: "NVIDIA",
    url: "https://www.nvidia.com/en-us/about-nvidia/privacy-policy/",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "intel",
    name: "Intel",
    url: "https://www.intel.com/content/www/us/en/privacy/intel-privacy-notice.html",
    category: "technology",
    active: true,
    checkInterval: 86400
  },
  // Social Media
  {
    slug: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com/privacy/policy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "instagram",
    name: "Instagram",
    url: "https://help.instagram.com/155833707900388",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "twitter",
    name: "Twitter/X",
    url: "https://twitter.com/en/privacy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "linkedin",
    name: "LinkedIn",
    url: "https://www.linkedin.com/legal/privacy-policy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "tiktok",
    name: "TikTok",
    url: "https://www.tiktok.com/legal/privacy-policy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "snapchat",
    name: "Snapchat",
    url: "https://www.snap.com/en-US/privacy/privacy-policy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "pinterest",
    name: "Pinterest",
    url: "https://policy.pinterest.com/en/privacy-policy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "reddit",
    name: "Reddit",
    url: "https://www.reddit.com/policies/privacy-policy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "discord",
    name: "Discord",
    url: "https://discord.com/privacy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    url: "https://www.whatsapp.com/legal/privacy-policy",
    category: "social-media",
    active: true,
    checkInterval: 86400
  },
  // E-commerce
  {
    slug: "amazon",
    name: "Amazon",
    url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=468496",
    category: "e-commerce",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "ebay",
    name: "eBay",
    url: "https://www.ebay.com/help/policies/member-behaviour-policies/user-privacy-notice-privacy-policy?id=4260",
    category: "e-commerce",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "shopify",
    name: "Shopify",
    url: "https://www.shopify.com/legal/privacy",
    category: "e-commerce",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "alibaba",
    name: "Alibaba",
    url: "https://www.alibabagroup.com/en-US/privacy-policy",
    category: "e-commerce",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "etsy",
    name: "Etsy",
    url: "https://www.etsy.com/legal/privacy/",
    category: "e-commerce",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "walmart",
    name: "Walmart",
    url: "https://corporate.walmart.com/privacy-security/walmart-privacy-policy",
    category: "e-commerce",
    active: true,
    checkInterval: 86400
  },
  // Entertainment & Streaming
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
  },
  {
    slug: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com/howyoutubeworks/user-settings/privacy/",
    category: "entertainment",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "disney-plus",
    name: "Disney+",
    url: "https://www.disneyplus.com/legal/privacy-policy",
    category: "entertainment",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "hulu",
    name: "Hulu",
    url: "https://www.hulu.com/privacy",
    category: "entertainment",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "hbo-max",
    name: "HBO Max",
    url: "https://www.warnermediaprivacy.com/",
    category: "entertainment",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "twitch",
    name: "Twitch",
    url: "https://www.twitch.tv/p/legal/privacy-notice/",
    category: "entertainment",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "paramount-plus",
    name: "Paramount+",
    url: "https://www.paramountplus.com/privacy-policy/",
    category: "entertainment",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "peacock",
    name: "Peacock",
    url: "https://www.peacocktv.com/privacy",
    category: "entertainment",
    active: true,
    checkInterval: 86400
  },
  // Finance & Banking
  {
    slug: "paypal",
    name: "PayPal",
    url: "https://www.paypal.com/us/legalhub/privacy-full",
    category: "finance",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "stripe",
    name: "Stripe",
    url: "https://stripe.com/privacy",
    category: "finance",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "square",
    name: "Square",
    url: "https://squareup.com/us/en/legal/general/privacy",
    category: "finance",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "coinbase",
    name: "Coinbase",
    url: "https://www.coinbase.com/legal/privacy",
    category: "finance",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "robinhood",
    name: "Robinhood",
    url: "https://robinhood.com/us/en/about/legal/privacy/",
    category: "finance",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "venmo",
    name: "Venmo",
    url: "https://www.venmo.com/legal/us-privacy-policy/",
    category: "finance",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "cash-app",
    name: "Cash App",
    url: "https://cash.app/legal/us/en-us/privacy",
    category: "finance",
    active: true,
    checkInterval: 86400
  },
  // Gaming
  {
    slug: "steam",
    name: "Steam",
    url: "https://store.steampowered.com/privacy_agreement/",
    category: "gaming",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "epic-games",
    name: "Epic Games",
    url: "https://www.epicgames.com/site/en-US/privacypolicy",
    category: "gaming",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "playstation",
    name: "PlayStation",
    url: "https://www.playstation.com/en-us/legal/privacy-policy/",
    category: "gaming",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "xbox",
    name: "Xbox",
    url: "https://privacy.microsoft.com/en-us/privacystatement#mainxboxmodule",
    category: "gaming",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "nintendo",
    name: "Nintendo",
    url: "https://www.nintendo.com/us/privacy-policy/",
    category: "gaming",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "roblox",
    name: "Roblox",
    url: "https://en.help.roblox.com/hc/en-us/articles/115004630823-Roblox-Privacy-and-Cookie-Policy",
    category: "gaming",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "minecraft",
    name: "Minecraft",
    url: "https://www.minecraft.net/en-us/privacy/mojang",
    category: "gaming",
    active: true,
    checkInterval: 86400
  },
  // Travel & Transportation
  {
    slug: "uber",
    name: "Uber",
    url: "https://www.uber.com/legal/en/document/?name=privacy-notice",
    category: "transportation",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "lyft",
    name: "Lyft",
    url: "https://www.lyft.com/privacy",
    category: "transportation",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "airbnb",
    name: "Airbnb",
    url: "https://www.airbnb.com/help/article/2855",
    category: "travel",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "booking-com",
    name: "Booking.com",
    url: "https://www.booking.com/content/privacy.html",
    category: "travel",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "expedia",
    name: "Expedia",
    url: "https://www.expedia.com/lp/lg-privacypolicy",
    category: "travel",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "tripadvisor",
    name: "TripAdvisor",
    url: "https://tripadvisor.mediaroom.com/us-privacy-policy",
    category: "travel",
    active: true,
    checkInterval: 86400
  },
  // Food Delivery
  {
    slug: "doordash",
    name: "DoorDash",
    url: "https://help.doordash.com/legal/document?type=cx-privacy-policy",
    category: "food-delivery",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "uber-eats",
    name: "Uber Eats",
    url: "https://www.uber.com/legal/en/document/?name=privacy-notice",
    category: "food-delivery",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "grubhub",
    name: "Grubhub",
    url: "https://www.grubhub.com/legal/privacy-policy",
    category: "food-delivery",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "instacart",
    name: "Instacart",
    url: "https://www.instacart.com/privacy",
    category: "food-delivery",
    active: true,
    checkInterval: 86400
  },
  // Healthcare
  {
    slug: "teladoc",
    name: "Teladoc",
    url: "https://www.teladoc.com/privacy-policy/",
    category: "healthcare",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "goodrx",
    name: "GoodRx",
    url: "https://www.goodrx.com/privacy-policy",
    category: "healthcare",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "zocdoc",
    name: "Zocdoc",
    url: "https://www.zocdoc.com/about/privacy/",
    category: "healthcare",
    active: true,
    checkInterval: 86400
  },
  // Education
  {
    slug: "coursera",
    name: "Coursera",
    url: "https://www.coursera.org/about/privacy",
    category: "education",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "udemy",
    name: "Udemy",
    url: "https://www.udemy.com/terms/privacy/",
    category: "education",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "khan-academy",
    name: "Khan Academy",
    url: "https://www.khanacademy.org/about/privacy-policy",
    category: "education",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "duolingo",
    name: "Duolingo",
    url: "https://www.duolingo.com/privacy",
    category: "education",
    active: true,
    checkInterval: 86400
  },
  // Communication
  {
    slug: "zoom",
    name: "Zoom",
    url: "https://zoom.us/privacy",
    category: "communication",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "slack",
    name: "Slack",
    url: "https://slack.com/privacy-policy",
    category: "communication",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "telegram",
    name: "Telegram",
    url: "https://telegram.org/privacy",
    category: "communication",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "signal",
    name: "Signal",
    url: "https://signal.org/legal/",
    category: "communication",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "skype",
    name: "Skype",
    url: "https://privacy.microsoft.com/en-us/privacystatement#mainskypemodule",
    category: "communication",
    active: true,
    checkInterval: 86400
  },
  // Productivity
  {
    slug: "notion",
    name: "Notion",
    url: "https://www.notion.so/Privacy-Policy",
    category: "productivity",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "dropbox",
    name: "Dropbox",
    url: "https://www.dropbox.com/privacy",
    category: "productivity",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "evernote",
    name: "Evernote",
    url: "https://evernote.com/privacy",
    category: "productivity",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "trello",
    name: "Trello",
    url: "https://www.atlassian.com/legal/privacy-policy",
    category: "productivity",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "asana",
    name: "Asana",
    url: "https://asana.com/terms#privacy",
    category: "productivity",
    active: true,
    checkInterval: 86400
  },
  // News & Media
  {
    slug: "cnn",
    name: "CNN",
    url: "https://www.cnn.com/privacy",
    category: "news",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "bbc",
    name: "BBC",
    url: "https://www.bbc.com/usingthebbc/privacy/",
    category: "news",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "nytimes",
    name: "The New York Times",
    url: "https://www.nytimes.com/privacy/privacy-policy",
    category: "news",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "wsj",
    name: "Wall Street Journal",
    url: "https://www.dowjones.com/privacy-notice/",
    category: "news",
    active: true,
    checkInterval: 86400
  },
  // Dating
  {
    slug: "tinder",
    name: "Tinder",
    url: "https://policies.tinder.com/privacy",
    category: "dating",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "bumble",
    name: "Bumble",
    url: "https://bumble.com/en/privacy",
    category: "dating",
    active: true,
    checkInterval: 86400
  },
  {
    slug: "hinge",
    name: "Hinge",
    url: "https://hinge.co/privacy",
    category: "dating",
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