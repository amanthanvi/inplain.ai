"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { internalFetch, trackEvent } from "@/lib/internal-api";

function getString(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || !v) {
    throw new Error(`Missing ${key}`);
  }
  return v;
}

export async function retryChangeEventSummary(formData: FormData): Promise<void> {
  const changeEventId = getString(formData, "changeEventId");

  const { userId } = await auth();
  if (!userId) return;

  await internalFetch(`/internal/change-events/${changeEventId}/retry-summary`, {
    method: "POST",
    userId,
    cache: "no-store",
  });

  revalidatePath(`/change-events/${changeEventId}`);
  redirect(`/change-events/${changeEventId}`);
}


/**
 * Record a citation click.
 *
 * Fire-and-forget from the diff viewer: analytics must never interfere with
 * the scroll-and-highlight interaction, so this never throws and returns
 * nothing for the caller to await on the critical path.
 */
export async function recordCitationClick(changeEventId: string, hunkId: string): Promise<void> {
  try {
    const { userId } = await auth();
    if (!userId) return;
    await trackEvent(userId, "citation_clicked", {
      change_event_id: changeEventId,
      hunk_id: hunkId,
    });
  } catch {
    // Intentionally ignored.
  }
}
