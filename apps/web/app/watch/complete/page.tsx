import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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
  const slug = getEntitySlug(searchParams.entity);
  if (!slug) {
    redirect("/companies");
  }

  const { userId } = await auth();
  if (!userId) {
    redirect(`/companies/${slug}`);
  }

  // v0.1.0: enforce Free tier doc limit (SPEC AC-4).
  const docLimit = 3;
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
    redirect(`/companies/${slug}?upgrade=1`);
  }

  await internalFetch("/internal/documents/watch", {
    method: "POST",
    userId,
    body: { entity_slug: slug },
    cache: "no-store",
  });

  redirect(`/companies/${slug}`);
}
