import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { internalFetch } from "@/lib/internal-api";

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

  await internalFetch("/internal/documents/watch", {
    method: "POST",
    userId,
    body: { entity_slug: slug },
    cache: "no-store",
  });

  redirect(`/companies/${slug}`);
}

