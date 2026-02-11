"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { internalFetch } from "@/lib/internal-api";

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

