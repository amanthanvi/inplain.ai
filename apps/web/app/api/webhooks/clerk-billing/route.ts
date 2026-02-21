import { clerkClient, type WebhookEvent } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { type NextRequest } from "next/server";

import { entitlementsForTier, tierFromBillingSubscription, type Tier } from "@/lib/billing-plans";
import { applyEntitlementsToDocuments } from "@/lib/entitlements";

export const runtime = "nodejs";

const BILLING_EVENT_TYPES = new Set([
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.pastDue",
  "subscriptionItem.created",
  "subscriptionItem.updated",
  "subscriptionItem.active",
  "subscriptionItem.canceled",
  "subscriptionItem.upcoming",
  "subscriptionItem.ended",
  "subscriptionItem.abandoned",
  "subscriptionItem.incomplete",
  "subscriptionItem.pastDue",
  "subscriptionItem.freeTrialEnding",
]);

function extractBillingWebhookUserId(event: WebhookEvent): string | null {
  const data = (event.data || {}) as {
    payer?: { user_id?: string };
    user_id?: string;
  };

  const payerUserId = data.payer?.user_id;
  if (typeof payerUserId === "string" && payerUserId.trim()) {
    return payerUserId;
  }

  const dataUserId = data.user_id;
  if (typeof dataUserId === "string" && dataUserId.trim()) {
    return dataUserId;
  }

  return null;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeStatus = (error as { status?: number }).status;
  if (maybeStatus === 404) return true;

  const maybeErrors = (error as { errors?: Array<{ code?: string }> }).errors;
  return Array.isArray(maybeErrors) && maybeErrors.some((entry) => entry?.code === "resource_not_found");
}

async function resolveTierForUser(userId: string): Promise<Tier> {
  const client = await clerkClient();
  try {
    const subscription = await client.billing.getUserBillingSubscription(userId);
    return tierFromBillingSubscription(subscription);
  } catch (error) {
    if (isNotFoundError(error)) {
      return "free";
    }
    throw error;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const signingSecret = process.env.CLERK_BILLING_WEBHOOK_SECRET;
  if (!signingSecret) {
    return Response.json(
      {
        error: {
          code: "WEBHOOK_NOT_CONFIGURED",
          message: "CLERK_BILLING_WEBHOOK_SECRET not set",
        },
      },
      { status: 500 },
    );
  }

  let event: WebhookEvent;
  try {
    event = await verifyWebhook(request, { signingSecret });
  } catch {
    return Response.json(
      {
        error: {
          code: "WEBHOOK_SIGNATURE_INVALID",
          message: "Invalid webhook signature",
        },
      },
      { status: 400 },
    );
  }

  if (!BILLING_EVENT_TYPES.has(event.type)) {
    return Response.json({ ok: true, ignored: true, reason: "non_billing_event" });
  }

  const clerkUserId = extractBillingWebhookUserId(event);
  if (!clerkUserId) {
    return Response.json({ ok: true, ignored: true, reason: "missing_user_id" });
  }

  const tier = await resolveTierForUser(clerkUserId);
  const entitlements = entitlementsForTier(tier);
  await applyEntitlementsToDocuments(clerkUserId, entitlements, { bestEffort: false });

  return Response.json({ ok: true, ignored: false, tier });
}
