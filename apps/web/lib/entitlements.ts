import "server-only";

import type { CheckAuthorizationFromSessionClaims } from "@clerk/types";

import { internalFetch } from "@/lib/internal-api";

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
        trackedDocuments: 300,
        scheduleTier: "1h",
        checkNowPerDay: 750,
        renderPerMonth: 4000,
        summariesPerMonth: 10000,
      };
    case "pro":
      return {
        tier,
        trackedDocuments: 40,
        scheduleTier: "6h",
        checkNowPerDay: 150,
        renderPerMonth: 400,
        summariesPerMonth: 1000,
      };
    case "free":
    default:
      return {
        tier: "free",
        trackedDocuments: 5,
        scheduleTier: "daily",
        checkNowPerDay: 15,
        renderPerMonth: 20,
        summariesPerMonth: 20,
      };
  }
}

export async function applyEntitlementsToDocuments(
  userId: string,
  entitlements: Entitlements,
): Promise<void> {
  try {
    await internalFetch("/internal/documents/apply-entitlements", {
      method: "POST",
      userId,
      body: {
        schedule_tier: entitlements.scheduleTier,
        max_active_documents: entitlements.trackedDocuments,
      },
      cache: "no-store",
    });
  } catch {
    // Best-effort: do not block page loads if the internal API is temporarily unavailable.
  }
}
