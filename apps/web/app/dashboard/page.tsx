"use client";

import Link from "next/link";
import { api, type Farm } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { useLoad } from "@/lib/useLoad";
import { useCurrentUser } from "@/lib/useCurrentUser";
import AuthGuard from "@/components/AuthGuard";
import DiagnosisRow, { type HistoryItem } from "@/components/DiagnosisRow";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}

const linkBtn = "inline-flex min-h-touch items-center justify-center rounded-control px-4 text-[0.95rem] font-medium transition-colors";

function Dashboard() {
  const { t } = useLanguage();
  const user = useCurrentUser();
  // Each section loads on its own, so one failing request never blanks the whole page.
  const farms = useLoad(() => api.farms.list());
  const recent = useLoad(() => api.diagnoses.history() as Promise<HistoryItem[]>);
  const unread = useLoad(() => api.notifications.list(true) as Promise<unknown[]>);

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const unreadCount = unread.data?.length ?? 0;

  const actions = [
    { href: "/diagnose", title: t("nav.diagnose"), desc: t("dashboard.action.diagnose.desc"), primary: true },
    { href: "/chat", title: t("nav.chat"), desc: t("dashboard.action.chat.desc") },
    { href: "/outbreaks", title: t("nav.outbreaks"), desc: t("dashboard.action.outbreaks.desc") },
    { href: "/history", title: t("nav.history"), desc: t("dashboard.action.history.desc") },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold text-primary-dark sm:text-3xl">
        {firstName ? t("dashboard.welcome").replace("{name}", firstName) : t("dashboard.welcomeNoName")}
      </h1>
      <p className="mt-1.5 text-ink-soft">{t("dashboard.subtitle")}</p>

      {unreadCount > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <Alert tone="info">{t("dashboard.unread").replace("{n}", String(unreadCount))}</Alert>
          </div>
          <Link href="/notifications" className={`${linkBtn} text-primary-dark hover:bg-primary-50`}>
            {t("dashboard.viewNotifications")}
          </Link>
        </div>
      )}

      <nav aria-label={t("dashboard.subtitle")} className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`block rounded-card border p-4 shadow-card transition-colors ${
              a.primary
                ? "border-primary bg-primary text-paper-raised hover:bg-primary-dark"
                : "border-line bg-paper-raised text-ink hover:border-primary"
            }`}
          >
            <span className="block font-semibold">{a.title}</span>
            <span className={`mt-0.5 block text-sm ${a.primary ? "text-paper-raised/90" : "text-ink-soft"}`}>{a.desc}</span>
          </Link>
        ))}
      </nav>

      <section className="mt-10" aria-labelledby="recent-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-xl font-semibold text-ink">
            {t("dashboard.recent")}
          </h2>
          <Link href="/history" className="rounded-control px-2 py-2 text-sm font-medium text-primary-dark underline underline-offset-2 hover:text-primary">
            {t("dashboard.viewAll")}
          </Link>
        </div>
        {recent.loading && <Skeleton className="h-24 w-full" />}
        {!recent.loading && recent.error && (
          <div className="space-y-3">
            <Alert>{t("history.loadFailed")}</Alert>
            <Button variant="secondary" onClick={recent.reload}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {!recent.loading && !recent.error && (recent.data ?? []).length === 0 && <EmptyState title={t("dashboard.recentEmpty")} />}
        {!recent.loading && !recent.error && (recent.data ?? []).length > 0 && (
          <ul className="space-y-3">
            {(recent.data ?? []).slice(0, 3).map((item) => (
              <li key={item.id}>
                <DiagnosisRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="farms-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="farms-heading" className="text-xl font-semibold text-ink">
            {t("dashboard.farms")}
          </h2>
          {(farms.data ?? []).length > 0 && (
            <Link href="/farm" className={`${linkBtn} border border-primary/40 bg-paper-raised text-primary-dark hover:bg-primary-50`}>
              {t("dashboard.addFarm")}
            </Link>
          )}
        </div>
        {farms.loading && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        )}
        {!farms.loading && farms.error && (
          <div className="space-y-3">
            <Alert>{t("dashboard.loadFarmsFailed")}</Alert>
            <Button variant="secondary" onClick={farms.reload}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {!farms.loading && !farms.error && (farms.data ?? []).length === 0 && (
          <EmptyState
            title={t("dashboard.farmsEmpty")}
            action={
              <Link href="/farm" className={`${linkBtn} bg-primary text-paper-raised hover:bg-primary-dark`}>
                {t("dashboard.addFirstFarm")}
              </Link>
            }
          />
        )}
        {!farms.loading && !farms.error && (farms.data ?? []).length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(farms.data as Farm[]).map((farm) => (
              <li key={farm.id}>
                <Link href={`/farm?id=${farm.id}`} className="block rounded-card hover:[&>div]:border-primary">
                  <Card padded={false} className="flex items-center gap-4 p-4 transition-colors">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-control bg-paper">
                      {farm.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={farm.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div aria-hidden="true" className="flex h-full w-full items-center justify-center bg-primary-50 text-lg font-semibold text-primary-dark">
                          {farm.name.trim().charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-ink">{farm.name}</h3>
                      <p className="truncate text-sm text-ink-soft">
                        {[farm.farm_type, farm.region].filter(Boolean).join(" · ") || t("dashboard.noDetails")}
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
