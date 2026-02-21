import "server-only";

export type Tier = "free" | "pro" | "business";

export type Entitlements = {
  tier: Tier;
  trackedDocuments: number;
  scheduleTier: "daily" | "6h" | "1h";
  checkNowPerDay: number;
  renderPerMonth: number;
  summariesPerMonth: number;
};

const ACTIVE_SUBSCRIPTION_ITEM_STATUSES = new Set([
  "active",
  "past_due",
  "pastDue",
  "incomplete",
  "upcoming",
]);

const ENTITLEMENTS_BY_TIER: Record<Tier, Entitlements> = {
  free: {
    tier: "free",
    trackedDocuments: 5,
    scheduleTier: "daily",
    checkNowPerDay: 15,
    renderPerMonth: 20,
    summariesPerMonth: 20,
  },
  pro: {
    tier: "pro",
    trackedDocuments: 40,
    scheduleTier: "6h",
    checkNowPerDay: 150,
    renderPerMonth: 400,
    summariesPerMonth: 1000,
  },
  business: {
    tier: "business",
    trackedDocuments: 300,
    scheduleTier: "1h",
    checkNowPerDay: 750,
    renderPerMonth: 4000,
    summariesPerMonth: 10000,
  },
};

type BillingSubscriptionLike = {
  subscriptionItems?: Array<{
    status?: string | null;
    plan?: { slug?: string | null } | null;
  }>;
} | null;

export function planKeys() {
  return {
    free: process.env.CLERK_PLAN_FREE || "free_user",
    pro: process.env.CLERK_PLAN_PRO || "inplain_pro",
    business: process.env.CLERK_PLAN_BUSINESS || "inplain_business",
  };
}

export function entitlementsForTier(tier: Tier): Entitlements {
  return ENTITLEMENTS_BY_TIER[tier];
}

export function tierFromPlanSlug(planSlug: string | null | undefined): Tier {
  const slug = (planSlug || "").trim();
  if (!slug) return "free";

  const keys = planKeys();
  if (slug === keys.business) return "business";
  if (slug === keys.pro) return "pro";
  if (slug === keys.free) return "free";
  return "free";
}

export function tierFromBillingSubscription(subscription: BillingSubscriptionLike): Tier {
  if (!subscription?.subscriptionItems?.length) return "free";

  let resolvedTier: Tier = "free";
  for (const item of subscription.subscriptionItems) {
    if (!item || !ACTIVE_SUBSCRIPTION_ITEM_STATUSES.has(item.status || "")) {
      continue;
    }

    const itemTier = tierFromPlanSlug(item.plan?.slug);
    if (itemTier === "business") return "business";
    if (itemTier === "pro") resolvedTier = "pro";
  }

  return resolvedTier;
}
