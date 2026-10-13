"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { NOTIFICATIONS_CHANGED } from "@/lib/notifications";
import { useLoad } from "@/lib/useLoad";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface NotificationOut {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const KNOWN_TYPES = ["outbreak_alert"];

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <NotificationsView />
    </AuthGuard>
  );
}

function NotificationsView() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const { data, loading, error, reload } = useLoad(() => api.notifications.list() as Promise<NotificationOut[]>);
  const [items, setItems] = useState<NotificationOut[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  async function markRead(id: string) {
    if (pending) return;
    setPending(id);
    // Optimistic update so the list feels instant; reverted below if the request fails.
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await api.notifications.markRead(id);
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
    } catch {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: false } : n)));
      toast(t("notifications.markFailed"), "error");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold text-primary-dark sm:text-3xl">{t("notifications.title")}</h1>

      <div className="mt-6" aria-busy={loading}>
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3">
            <Alert>{t("notifications.loadFailed")}</Alert>
            <Button variant="secondary" onClick={reload}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {!loading && !error && items.length === 0 && <EmptyState title={t("notifications.empty")} />}

        {!loading && !error && items.length > 0 && (
          <ul className="space-y-3">
            {items.map((n) => (
              <li key={n.id}>
                <Card padded={false} className={`p-4 ${n.is_read ? "" : "border-primary/50 bg-primary-50"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {!n.is_read && (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-paper-raised">{t("notifications.new")}</span>
                    )}
                    {KNOWN_TYPES.includes(n.type) && (
                      <span className="rounded-full bg-chili-50 px-2.5 py-0.5 text-xs font-semibold text-chili-dark">
                        {t(`notifications.type.${n.type}`)}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 font-sans text-base font-semibold text-ink [overflow-wrap:anywhere]">{n.title}</h2>
                  <p className="mt-1 text-ink [overflow-wrap:anywhere]">{n.body}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-ink-soft">{formatDateTime(n.created_at, language)}</p>
                    {!n.is_read && (
                      <Button variant="secondary" onClick={() => markRead(n.id)} disabled={pending !== null}>
                        {t("notifications.markRead")}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
