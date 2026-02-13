import { auth } from "@clerk/nextjs/server";

import { applyEntitlementsToDocuments, getEntitlementsForHas } from "@/lib/entitlements";
import { internalFetch, type ExportOut } from "@/lib/internal-api";

export const runtime = "nodejs";

function clerkEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(): Promise<Response> {
  if (!clerkEnabled()) {
    return new Response("Auth is not configured.", { status: 500 });
  }

  const { userId, has } = await auth();
  if (!userId) {
    return new Response("Sign in required.", { status: 401 });
  }

  const entitlements = getEntitlementsForHas(has);
  await applyEntitlementsToDocuments(userId, entitlements);

  const limit = entitlements.tier === "free" ? 10 : null;
  const path = limit ? `/internal/export?limit_change_events=${limit}` : "/internal/export";

  const payload = await internalFetch<ExportOut>(path, { userId, cache: "no-store" });

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="inplain-export-${isoDate()}.json"`,
    },
  });
}
