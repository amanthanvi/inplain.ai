"use server";

import { auth } from "@clerk/nextjs/server";

import { internalFetch, type NotificationOut, type UnreadCountOut } from "@/lib/internal-api";

export async function getUnreadCount(): Promise<number> {
  const { userId } = await auth();
  if (!userId) return 0;

  const out = await internalFetch<UnreadCountOut>("/internal/notifications/unread-count", {
    userId,
    cache: "no-store",
  });
  return out.unread;
}

export async function listNotifications(): Promise<NotificationOut[]> {
  const { userId } = await auth();
  if (!userId) return [];

  return internalFetch<NotificationOut[]>("/internal/notifications", { userId, cache: "no-store" });
}

export async function markNotificationsRead(notificationIds: string[]): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  if (notificationIds.length === 0) return;

  await internalFetch("/internal/notifications/mark-read", {
    method: "POST",
    userId,
    body: { notification_ids: notificationIds },
    cache: "no-store",
  });
}

