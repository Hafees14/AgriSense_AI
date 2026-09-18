"use client";

import { useCallback, useEffect, useState } from "react";
import {
  discardQueuedItem,
  listQueue,
  retryFailedItem,
  syncQueue,
  type QueuedDiagnosis,
} from "@/lib/offlineQueue";
import { useLanguage } from "@/lib/i18n";

// Drop this on any page that lets a farmer submit a diagnosis (currently
// just /diagnose) so queued-while-offline photos are visible and get
// synced automatically once the connection comes back — without needing a
// service worker or the still-patchy Background Sync API. This covers the
// common case (farmer reopens the app, or it's still open, once back in
// signal) but NOT true background sync while the tab is fully closed.
export default function OfflineQueueBanner() {
  const { t } = useLanguage();
  const [queue, setQueue] = useState<QueuedDiagnosis[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const refresh = useCallback(async () => {
    setQueue(await listQueue());
  }, []);

  const runSync = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    setSyncing(true);
    try {
      await syncQueue();
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    refresh();
    runSync();

    function handleOnline() {
      setIsOnline(true);
      runSync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Fallback for the (fairly common) case where the 'online' event
    // doesn't fire reliably on a given device/browser — check periodically
    // too, so a queued photo doesn't sit stuck until the app is reopened.
    const interval = setInterval(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) runSync();
    }, 30_000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, [refresh, runSync]);

  if (queue.length === 0 && isOnline) return null;

  const pendingCount = queue.filter((i) => i.status !== "failed").length;
  const failedItems = queue.filter((i) => i.status === "failed");

  return (
    <div className="mb-4 space-y-2">
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-lg border border-line bg-paper-raised p-3 text-sm text-ink-soft">
          <span aria-hidden>📡</span>
          {t("offline.noConnection")}
        </div>
      )}

      {pendingCount > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-earth-50 p-3 text-sm text-earth-dark">
          <span className="flex items-center gap-2">
            <span aria-hidden>⏳</span>
            {pendingCount} {pendingCount === 1 ? t("offline.oneQueued") : t("offline.manyQueued")}
          </span>
          {isOnline && (
            <button
              onClick={runSync}
              disabled={syncing}
              className="shrink-0 rounded-full bg-earth px-3 py-1.5 text-xs font-semibold text-paper disabled:opacity-50"
            >
              {syncing ? t("offline.syncing") : t("offline.syncNow")}
            </button>
          )}
        </div>
      )}

      {failedItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-3 rounded-lg bg-chili-50 p-3 text-sm text-chili-dark"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden>⚠️</span>
            {item.diagnosisType} — {item.lastError ?? t("offline.uploadFailed")}
          </span>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => retryFailedItem(item.id).then(runSync)}
              className="rounded-full bg-chili px-3 py-1.5 text-xs font-semibold text-paper"
            >
              {t("offline.retry")}
            </button>
            <button
              onClick={() => discardQueuedItem(item.id).then(refresh)}
              className="rounded-full border border-chili/40 px-3 py-1.5 text-xs font-semibold text-chili-dark"
            >
              {t("offline.discard")}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}