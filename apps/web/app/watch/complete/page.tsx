import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getEntitlementsForHas } from "@/lib/entitlements";
import { internalFetch, type DocumentOut, type EntityOut } from "@/lib/internal-api";

export const dynamic = "force-dynamic";

function getEntitySlug(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] || null;
  return raw;
}

export default async function WatchCompletePage({
  searchParams,
}: {
  searchParams: { entity?: string | string[] };
}) {
  const { entity: entityParam } = await Promise.resolve(searchParams);
  const slug = getEntitySlug(entityParam);
  if (!slug) {
    redirect("/companies");
  }

  const { userId, has } = await auth();
  if (!userId) {
    redirect(`/companies/${slug}`);
  }

  const entitlements = getEntitlementsForHas(has);
  const docLimit = entitlements.trackedDocuments;
  const [entity, docs] = await Promise.all([
    internalFetch<EntityOut>(`/internal/entities/${slug}`, { cache: "no-store" }),
    internalFetch<DocumentOut[]>("/internal/documents", { userId, cache: "no-store" }),
  ]);

  const trackedForEntity = docs.filter((d) => d.entity_id === entity.id);
  const policyUrls = entity.policy_urls || {};

  const wantsDocTypes: Array<DocumentOut["doc_type"]> = ["privacy", "tos", "cookie"];
  const toCreate = wantsDocTypes.filter((t) => {
    const hasUrl = typeof policyUrls[t] === "string" && (policyUrls[t] as string).length > 0;
    const already = trackedForEntity.some((d) => d.doc_type === t);
    return hasUrl && !already;
  }).length;

  if (docs.length + toCreate > docLimit) {
    redirect(`/companies/${slug}?upgrade=1&reason=doc_limit`);
  }

  await internalFetch("/internal/documents/watch", {
    method: "POST",
    userId,
    body: { entity_slug: slug, schedule_tier: entitlements.scheduleTier },
    cache: "no-store",
  });

  redirect(`/companies/${slug}`);
}
