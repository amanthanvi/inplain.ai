import "server-only";

import type { CheckAuthorizationFromSessionClaims } from "@clerk/types";

import {
  entitlementsForTier,
  planKeys,
  type Entitlements,
  type Tier,
} from "@/lib/billing-plans";
import { internalFetch } from "@/lib/internal-api";

export type { Entitlements, Tier };

export function getEntitlementsForHas(has: CheckAuthorizationFromSessionClaims): Entitlements {
  const plans = planKeys();

  const tier: Tier = has({ plan: plans.business })
    ? "business"
    : has({ plan: plans.pro })
      ? "pro"
      : "free";

  return entitlementsForTier(tier);
}

type ApplyEntitlementsOptions = {
  bestEffort?: boolean;
};

export async function applyEntitlementsToDocuments(
  userId: string,
  entitlements: Entitlements,
  options: ApplyEntitlementsOptions = {},
): Promise<void> {
  const bestEffort = options.bestEffort ?? true;
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
    if (!bestEffort) {
      throw new Error("Failed to apply entitlements");
    }
    // Best-effort: do not block page loads if the internal API is temporarily unavailable.
  }
}
