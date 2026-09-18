"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api-client";

interface NotificationOut {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

// Polls unread count periodically so an outbreak alert (or any other
// notification) that lands while the farmer is already using the app
// doesn't sit invisible until they happen to reload — this is what makes
// the outbreak-alert feature actually visible, not just recorded.
const POLL_INTERVAL_MS = 60_000;

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6.2.3.4 0 .8-.5.8H4.5c-.5 0-.8-.4-.5-.8.5-.7 2-2.2 2-6.2Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

export default function NotificationBell() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const unread = (await api.notifications.list(true)) as NotificationOut[];
        if (!cancelled) setUnreadCount(unread.length);
      } catch {
        /* not logged in, or a transient failure — bell just shows 0 */
      }
    }

    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // Re-check immediately whenever the farmer navigates to/from the
    // notifications page, so the badge clears as soon as they've read them.
  }, [pathname]);

  return (
    <Link
      href="/notifications"
      className="relative flex h-10 w-10 items-center justify-center rounded text-ink-soft hover:bg-primary-50 hover:text-primary"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <BellIcon />
      {unreadCount > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-chili px-1 text-[10px] font-bold text-paper">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}