"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";

interface NotificationOut {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICON: Record<string, string> = {
  outbreak_alert: "🚨",
};

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <NotificationsView />
    </AuthGuard>
  );
}

function NotificationsView() {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationOut[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = (await api.notifications.list()) as NotificationOut[];
    setNotifications(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleOpen(notif: NotificationOut) {
    if (notif.is_read) return;
    // Optimistic update so the badge/list feel instant rather than waiting
    // on the round trip.
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
    try {
      await api.notifications.markRead(notif.id);
    } catch {
      // Revert on failure so the UI doesn't lie about read state.
      setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: false } : n)));
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-primary">🔔 {t("notifications.title")}</h1>

      {loading && <p className="text-neutral-500">Loading…</p>}

      <div className="space-y-2">
        {notifications.map((notif) => (
          <button
            key={notif.id}
            onClick={() => handleOpen(notif)}
            className={`w-full rounded-xl border p-4 text-left transition ${
              notif.is_read ? "border-neutral-200 bg-white" : "border-primary/30 bg-primary/5"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">
                {TYPE_ICON[notif.type] ?? "ℹ️"} {notif.title}
              </p>
              {!notif.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </div>
            <p className="mt-1 text-sm text-neutral-600">{notif.body}</p>
            <p className="mt-1 text-xs text-neutral-400">{new Date(notif.created_at).toLocaleString()}</p>
          </button>
        ))}

        {!loading && notifications.length === 0 && (
          <p className="rounded-xl bg-neutral-50 p-6 text-center text-neutral-500">{t("notifications.empty")}</p>
        )}
      </div>
    </main>
  );
}