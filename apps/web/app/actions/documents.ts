"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { internalFetch } from "@/lib/internal-api";

function getString(formData: FormData, key: string): string {
  const v = formData.get(key);
  if (typeof v !== "string" || !v) {
    throw new Error(`Missing ${key}`);
  }
  return v;
}

export async function checkNow(formData: FormData): Promise<void> {
  const documentId = getString(formData, "documentId");
  const slug = getString(formData, "entitySlug");

  const { userId } = await auth();
  if (!userId) return;

  await internalFetch(`/internal/documents/${documentId}/check-now`, {
    method: "POST",
    userId,
    cache: "no-store",
  });

  revalidatePath(`/companies/${slug}`);
}

export async function deleteDocument(formData: FormData): Promise<void> {
  const documentId = getString(formData, "documentId");
  const slug = getString(formData, "entitySlug");

  const { userId } = await auth();
  if (!userId) return;

  await internalFetch(`/internal/documents/${documentId}`, {
    method: "DELETE",
    userId,
    cache: "no-store",
  });

  revalidatePath(`/companies/${slug}`);
  revalidatePath("/dashboard");
}

export async function unwatchEntity(formData: FormData): Promise<void> {
  const slug = getString(formData, "entitySlug");
  const ids = formData
    .getAll("documentId")
    .filter((v): v is string => typeof v === "string" && Boolean(v));

  const { userId } = await auth();
  if (!userId) return;

  await Promise.all(
    ids.map((documentId) =>
      internalFetch(`/internal/documents/${documentId}`, {
        method: "DELETE",
        userId,
        cache: "no-store",
      }),
    ),
  );

  revalidatePath(`/companies/${slug}`);
  revalidatePath("/dashboard");
}
