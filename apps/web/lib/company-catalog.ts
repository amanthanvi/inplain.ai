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
];

