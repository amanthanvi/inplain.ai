"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import {
  getUnreadCount,
  listNotifications,
  markNotificationsRead,
} from "@/app/actions/notifications";
import type { NotificationOut } from "@/lib/internal-api";

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<NotificationOut[]>([]);
  const [isPending, startTransition] = useTransition();

  const unreadIds = useMemo(
    () => items.filter((n) => !n.read_at).map((n) => n.id),
    [items],
  );

  const refreshUnread = () => {
    startTransition(async () => {
      setUnread(await getUnreadCount());
    });
  };

  useEffect(() => {
    refreshUnread();
    const t = window.setInterval(refreshUnread, 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const list = await listNotifications();
      setItems(list);
      const ids = list.filter((n) => !n.read_at).map((n) => n.id);
      if (ids.length > 0) {
        await markNotificationsRead(ids);
        const nowIso = new Date().toISOString();
        const idSet = new Set(ids);
        setItems((prev) => prev.map((n) => (idSet.has(n.id) ? { ...n, read_at: nowIso } : n)));
        setUnread(0);
      }
    });
  }, [open]);

  return (
    <div className="bellWrap">
      <button
        type="button"
        className="bellButton"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <BellIcon />
        {unread > 0 ? <span className="bellBadge">{unread > 99 ? "99+" : unread}</span> : null}
      </button>

      {open ? (
        <div className="bellDropdown" role="menu">
          <div className="bellHeader">
            <div style={{ fontWeight: 650 }}>Notifications</div>
            <button className="btn btnGhost" type="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>

          {items.length === 0 ? (
            <div className="bellEmpty muted">
              {isPending ? "Loading…" : "No notifications yet."}
            </div>
          ) : (
            <div className="bellList">
              {items.map((n) => (
                <div key={n.id} className="bellItem">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 650, fontSize: 13 }}>{n.title}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {new Date(n.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                    {n.body}
                  </div>
                  {typeof n.payload.change_event_id === "string" ? (
                    <div style={{ marginTop: 10 }}>
                      <Link className="btn btnGhost" href={`/change-events/${n.payload.change_event_id}`}>
                        View change
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {unreadIds.length > 0 ? (
            <div className="bellFooter muted">Marked {unreadIds.length} as read.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
