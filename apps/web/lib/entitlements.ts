import "server-only";

import type { CheckAuthorizationFromSessionClaims } from "@clerk/types";

export type Tier = "free" | "pro" | "business";

export type Entitlements = {
  tier: Tier;
  trackedDocuments: number;
  scheduleTier: "daily" | "6h" | "1h";
  checkNowPerDay: number;
  renderPerMonth: number;
  summariesPerMonth: number;
};

function planKeys() {
  return {
    pro: process.env.CLERK_PLAN_PRO || "user:pro",
    business: process.env.CLERK_PLAN_BUSINESS || "user:business",
  };
}

export function getEntitlementsForHas(has: CheckAuthorizationFromSessionClaims): Entitlements {
  const plans = planKeys();

  const tier: Tier = has({ plan: plans.business })
    ? "business"
    : has({ plan: plans.pro })
      ? "pro"
      : "free";

  switch (tier) {
    case "business":
      return {
        tier,
        trackedDocuments: 200,
        scheduleTier: "1h",
        checkNowPerDay: 500,
        renderPerMonth: 2000,
        summariesPerMonth: 5000,
      };
    case "pro":
      return {
        tier,
        trackedDocuments: 25,
        scheduleTier: "6h",
        checkNowPerDay: 100,
        renderPerMonth: 200,
        summariesPerMonth: 500,
      };
    case "free":
    default:
      return {
        tier: "free",
        trackedDocuments: 3,
        scheduleTier: "daily",
        checkNowPerDay: 10,
        renderPerMonth: 0,
        summariesPerMonth: 10,
      };
  }
}
