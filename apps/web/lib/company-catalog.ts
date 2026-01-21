export type CompanyCategory =
  | "technology"
  | "social"
  | "ecommerce"
  | "finance"
  | "productivity"
  | "other";

export type CompanyCatalogDocument = {
  title: string;
  url: string;
  type: "privacy" | "tos" | "cookie" | "other";
};

export type CompanyCatalogItem = {
  slug: string;
  name: string;
  category: CompanyCategory;
  websiteUrl: string;
  description: string;
  documents: CompanyCatalogDocument[];
  stats?: {
    watchers: number;
    privacyScore: number;
    risk: "low" | "medium" | "high";
  };
};

export const COMPANY_CATALOG: CompanyCatalogItem[] = [
  {
    slug: "google",
    name: "Google",
    category: "technology",
    websiteUrl: "https://www.google.com",
    description:
      "Search, Maps, YouTube, Android, and a sprawling ecosystem of consumer services.",
    documents: [
      {
        title: "Privacy Policy",
        url: "https://policies.google.com/privacy",
        type: "privacy",
      },
      {
        title: "Terms of Service",
        url: "https://policies.google.com/terms",
        type: "tos",
      },
    ],
    stats: { watchers: 179, privacyScore: 71, risk: "low" },
  },
  {
    slug: "apple",
    name: "Apple",
    category: "technology",
    websiteUrl: "https://www.apple.com",
    description: "Hardware + software platform with services across devices and the App Store.",
    documents: [
      {
        title: "Privacy Policy",
        url: "https://www.apple.com/legal/privacy/",
        type: "privacy",
      },
      {
        title: "Terms of Use",
        url: "https://www.apple.com/legal/internet-services/terms/site.html",
        type: "tos",
      },
    ],
    stats: { watchers: 94, privacyScore: 78, risk: "low" },
  },
  {
    slug: "meta",
    name: "Meta",
    category: "social",
    websiteUrl: "https://about.meta.com",
    description: "Facebook, Instagram, and an ads-driven social platform.",
    documents: [
      {
        title: "Privacy Policy",
        url: "https://www.facebook.com/privacy/policy/",
        type: "privacy",
      },
      {
        title: "Terms of Service",
        url: "https://www.facebook.com/terms.php",
        type: "tos",
      },
    ],
    stats: { watchers: 133, privacyScore: 62, risk: "medium" },
  },
  {
    slug: "amazon",
    name: "Amazon",
    category: "ecommerce",
    websiteUrl: "https://www.amazon.com",
    description: "E-commerce, fulfillment, subscriptions, and a large consumer cloud footprint.",
    documents: [
      {
        title: "Privacy Notice",
        url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=468496",
        type: "privacy",
      },
      {
        title: "Conditions of Use",
        url: "https://www.amazon.com/gp/help/customer/display.html?nodeId=508088",
        type: "tos",
      },
    ],
    stats: { watchers: 76, privacyScore: 58, risk: "medium" },
  },
  {
    slug: "microsoft",
    name: "Microsoft",
    category: "productivity",
    websiteUrl: "https://www.microsoft.com",
    description: "Windows, Office, Xbox, and cloud services used globally.",
    documents: [
      {
        title: "Privacy Statement",
        url: "https://privacy.microsoft.com/privacystatement",
        type: "privacy",
      },
      {
        title: "Microsoft Services Agreement",
        url: "https://www.microsoft.com/servicesagreement",
        type: "tos",
      },
    ],
    stats: { watchers: 88, privacyScore: 69, risk: "low" },
  },
  {
    slug: "github",
    name: "GitHub",
    category: "productivity",
    websiteUrl: "https://github.com",
    description: "Developer platform for source control, CI, and collaboration.",
    documents: [
      {
        title: "Privacy Statement",
        url: "https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement",
        type: "privacy",
      },
      {
        title: "Terms of Service",
        url: "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
        type: "tos",
      },
    ],
    stats: { watchers: 124, privacyScore: 72, risk: "low" },
  },
  {
    slug: "netflix",
    name: "Netflix",
    category: "other",
    websiteUrl: "https://www.netflix.com",
    description: "Streaming platform with personalized recommendations and ads offerings.",
    documents: [
      { title: "Privacy Statement", url: "https://help.netflix.com/legal/privacy", type: "privacy" },
      { title: "Terms of Use", url: "https://help.netflix.com/legal/termsofuse", type: "tos" },
    ],
    stats: { watchers: 68, privacyScore: 60, risk: "medium" },
  },
  {
    slug: "spotify",
    name: "Spotify",
    category: "other",
    websiteUrl: "https://www.spotify.com",
    description: "Music and podcast streaming with personalization and ads.",
    documents: [
      {
        title: "Privacy Policy",
        url: "https://www.spotify.com/us/legal/privacy-policy/",
        type: "privacy",
      },
      {
        title: "Terms and Conditions",
        url: "https://www.spotify.com/us/legal/end-user-agreement/",
        type: "tos",
      },
    ],
    stats: { watchers: 57, privacyScore: 59, risk: "medium" },
  },
  {
    slug: "slack",
    name: "Slack",
    category: "productivity",
    websiteUrl: "https://slack.com",
    description: "Team messaging and collaboration used across companies worldwide.",
    documents: [
      { title: "Privacy Policy", url: "https://slack.com/trust/privacy/privacy-policy", type: "privacy" },
      { title: "Terms of Service", url: "https://slack.com/terms-of-service", type: "tos" },
    ],
    stats: { watchers: 49, privacyScore: 66, risk: "low" },
  },
  {
    slug: "zoom",
    name: "Zoom",
    category: "productivity",
    websiteUrl: "https://zoom.us",
    description: "Video conferencing and collaboration tools used by teams and individuals.",
    documents: [
      { title: "Privacy Statement", url: "https://explore.zoom.us/en/privacy/", type: "privacy" },
      { title: "Terms of Service", url: "https://explore.zoom.us/en/terms/", type: "tos" },
    ],
    stats: { watchers: 45, privacyScore: 61, risk: "medium" },
  },
  {
    slug: "linkedin",
    name: "LinkedIn",
    category: "social",
    websiteUrl: "https://www.linkedin.com",
    description: "Professional network for identity, hiring, ads, and content.",
    documents: [
      { title: "Privacy Policy", url: "https://www.linkedin.com/legal/privacy-policy", type: "privacy" },
      { title: "User Agreement", url: "https://www.linkedin.com/legal/user-agreement", type: "tos" },
    ],
    stats: { watchers: 83, privacyScore: 58, risk: "medium" },
  },
  {
    slug: "twitter",
    name: "X (Twitter)",
    category: "social",
    websiteUrl: "https://x.com",
    description: "Social network for posts, DMs, and ads.",
    documents: [
      { title: "Privacy Policy", url: "https://twitter.com/en/privacy", type: "privacy" },
      { title: "Terms of Service", url: "https://twitter.com/en/tos", type: "tos" },
    ],
    stats: { watchers: 77, privacyScore: 55, risk: "medium" },
  },
  {
    slug: "tiktok",
    name: "TikTok",
    category: "social",
    websiteUrl: "https://www.tiktok.com",
    description: "Short-form video platform with ads and recommendation-driven feeds.",
    documents: [
      {
        title: "Privacy Policy (US)",
        url: "https://www.tiktok.com/legal/page/us/privacy-policy/en",
        type: "privacy",
      },
      {
        title: "Terms of Service (US)",
        url: "https://www.tiktok.com/legal/page/us/terms-of-service/en",
        type: "tos",
      },
    ],
    stats: { watchers: 92, privacyScore: 52, risk: "high" },
  },
  {
    slug: "dropbox",
    name: "Dropbox",
    category: "productivity",
    websiteUrl: "https://www.dropbox.com",
    description: "File storage and collaboration across devices and teams.",
    documents: [
      { title: "Privacy", url: "https://www.dropbox.com/privacy", type: "privacy" },
      { title: "Terms", url: "https://www.dropbox.com/terms", type: "tos" },
    ],
    stats: { watchers: 41, privacyScore: 70, risk: "low" },
  },
  {
    slug: "stripe",
    name: "Stripe",
    category: "finance",
    websiteUrl: "https://stripe.com",
    description: "Payments infrastructure used by online businesses and platforms.",
    documents: [
      { title: "Privacy", url: "https://stripe.com/privacy", type: "privacy" },
      { title: "Legal", url: "https://stripe.com/legal", type: "tos" },
    ],
    stats: { watchers: 36, privacyScore: 73, risk: "low" },
  },
  {
    slug: "notion",
    name: "Notion",
    category: "productivity",
    websiteUrl: "https://www.notion.so",
    description: "Workspace for docs, wikis, and project management.",
    documents: [
      {
        title: "Privacy Policy",
        url: "https://www.notion.so/notion/Privacy-Policy-3468d120cf614d4c9014c09f6adc9091",
        type: "privacy",
      },
      { title: "Terms", url: "https://www.notion.so/terms", type: "tos" },
    ],
    stats: { watchers: 39, privacyScore: 68, risk: "low" },
  },
];
