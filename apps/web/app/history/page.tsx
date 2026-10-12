"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { useLoad } from "@/lib/useLoad";
import AuthGuard from "@/components/AuthGuard";
import DiagnosisRow, { type HistoryItem } from "@/components/DiagnosisRow";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";

const FILTERS = ["", "disease", "pest", "plant_id"];
const PAGE_SIZE = 20; // the API returns everything; this only limits how much is rendered at once

export default function HistoryPage() {
  return (
    <AuthGuard>
      <History />
    </AuthGuard>
  );
}

function History() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const { data, loading, error, reload } = useLoad(
    () => api.diagnoses.history(filter ? { type: filter } : undefined) as Promise<HistoryItem[]>,
    [filter],
  );
  const items = data ?? [];

  const filterLabel = (f: string) => (f ? t(`diagnose.type.${f}`) : t("history.filter.all"));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold text-primary-dark sm:text-3xl">{t("history.title")}</h1>
      <p className="mt-1.5 text-ink-soft">{t("history.subtitle")}</p>

      <div role="group" aria-label={t("history.filterLabel")} className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            type="button"
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setVisible(PAGE_SIZE);
            }}
            className={`min-h-touch rounded-full border px-4 text-[0.95rem] font-medium transition-colors ${
              filter === f ? "border-primary bg-primary text-paper-raised" : "border-line bg-paper-raised text-ink hover:border-ink-soft/50"
            }`}
          >
            {filterLabel(f)}
          </button>
        ))}
      </div>

      <div className="mt-6" aria-live="polite" aria-busy={loading}>
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3">
            <Alert>{t("history.loadFailed")}</Alert>
            <Button variant="secondary" onClick={reload}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            title={filter ? t("history.emptyFiltered") : t("history.empty")}
            action={
              !filter && (
                <Link href="/diagnose" className="inline-flex min-h-touch items-center rounded-control bg-primary px-5 font-medium text-paper-raised hover:bg-primary-dark">
                  {t("history.first")}
                </Link>
              )
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <p className="mb-3 text-sm text-ink-soft">{t("history.count").replace("{n}", String(items.length))}</p>
            <ul className="space-y-3">
              {items.slice(0, visible).map((item) => (
                <li key={item.id}>
                  <DiagnosisRow item={item} />
                </li>
              ))}
            </ul>
            {visible < items.length && (
              <div className="mt-5 flex justify-center">
                <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                  {t("history.showMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
