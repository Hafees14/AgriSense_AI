"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { formatDateTime, percent, splitLabel } from "@/lib/format";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { useLoad } from "@/lib/useLoad";
import SeverityTag from "@/components/SeverityTag";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { Table, Td, Th } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";

interface QueueItem {
  id: string;
  diagnosis_type: string;
  result_label: string;
  confidence_score: number;
  severity: string | null;
  image_url: string;
  farmer_name: string;
  created_at: string;
}

interface RegionSummary {
  region: string;
  diagnosis_count: number;
  disease_count: number;
  pest_count: number;
  high_severity_count: number;
  needs_review_count: number;
  top_issue: string | null;
}

interface OfficerSummary {
  window_days: number;
  pending_review_count: number;
  reviewed_in_window_count: number;
  total_farmers: number;
  regions: RegionSummary[];
}

const TYPE_KEYS = ["disease", "pest", "plant_id"];

export default function ReviewPage() {
  return (
    <AuthGuard>
      <ReviewGate />
    </AuthGuard>
  );
}

// The API rejects a non-officer with a 403 regardless — this just avoids
// showing a farmer a page that would only ever error for them.
function ReviewGate() {
  const user = useCurrentUser();
  const { t } = useLanguage();

  if (user === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-6 h-32 w-full" />
      </div>
    );
  }
  if (user.role !== "officer") {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <EmptyState title={t("review.officersOnly")} />
      </div>
    );
  }
  return <OfficerPortal />;
}

function OfficerPortal() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const summary = useLoad(() => api.reviews.summary() as Promise<OfficerSummary>);
  const queue = useLoad(() => api.reviews.queue() as Promise<QueueItem[]>);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (queue.data) setItems(queue.data);
  }, [queue.data]);

  async function handleVerify(id: string) {
    if (submittingId) return;
    setSubmittingId(id);
    try {
      await api.reviews.submit(id, notes[id]);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast(t("review.verifiedToast"), "success");
      // The region figures and counts are now stale — refresh them in the
      // background rather than blocking the "removed from queue" feedback.
      summary.reload();
    } catch {
      toast(t("review.verifyFailed"), "error");
    } finally {
      setSubmittingId(null);
    }
  }

  const s = summary.data;
  const stats: { label: string; value: number | undefined; tone: string }[] = [
    { label: t("review.statPending"), value: s?.pending_review_count, tone: "text-earth-dark" },
    { label: t("review.statReviewed"), value: s?.reviewed_in_window_count, tone: "text-primary-dark" },
    { label: t("review.statFarmers"), value: s?.total_farmers, tone: "text-ink" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold text-primary-dark sm:text-3xl">{t("review.title")}</h1>
      <p className="mt-1.5 text-ink-soft">{t("review.subtitle")}</p>

      {summary.error && (
        <div className="mt-6 space-y-3">
          <Alert>{t("review.loadFailed")}</Alert>
          <Button variant="secondary" onClick={summary.reload}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {!summary.error && (
        <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((st) => (
            <Card key={st.label} padded={false} className="flex flex-col-reverse p-4">
              <dt className="mt-1 text-sm text-ink-soft">{st.label}</dt>
              <dd className={`text-3xl font-semibold ${st.tone}`}>{summary.loading || st.value === undefined ? <Skeleton className="h-9 w-16" /> : st.value}</dd>
            </Card>
          ))}
        </dl>
      )}

      {s && s.regions.length > 0 && (
        <section className="mt-10" aria-labelledby="areas-heading">
          <h2 id="areas-heading" className="mb-3 text-xl font-semibold text-ink">
            {t("review.byArea")} <span className="text-base font-normal text-ink-soft">({t("review.last30days")})</span>
          </h2>
          <Table caption={t("review.byArea")}>
            <thead>
              <tr>
                <Th>{t("review.colArea")}</Th>
                <Th className="capitalize">{t("review.reports")}</Th>
                <Th className="capitalize">{t("review.needReview")}</Th>
                <Th className="capitalize">{t("review.highSeverity")}</Th>
                <Th className="capitalize">{t("review.disease")}</Th>
                <Th className="capitalize">{t("review.pest")}</Th>
                <Th>{t("review.topIssue")}</Th>
              </tr>
            </thead>
            <tbody>
              {s.regions.map((r) => (
                <tr key={r.region}>
                  <Td className="font-semibold">{r.region}</Td>
                  <Td>{r.diagnosis_count}</Td>
                  <Td className={r.needs_review_count > 0 ? "font-semibold text-earth-dark" : ""}>{r.needs_review_count}</Td>
                  <Td className={r.high_severity_count > 0 ? "font-semibold text-chili-dark" : ""}>{r.high_severity_count}</Td>
                  <Td>{r.disease_count}</Td>
                  <Td>{r.pest_count}</Td>
                  <Td>{r.top_issue ? splitLabel(r.top_issue).condition : "–"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>
      )}

      <section className="mt-10" aria-labelledby="queue-heading">
        <h2 id="queue-heading" className="mb-3 text-xl font-semibold text-ink">
          {t("review.queueHeading")}
        </h2>

        {queue.loading && (
          <div className="space-y-3">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        )}

        {!queue.loading && queue.error && (
          <div className="space-y-3">
            <Alert>{t("review.loadFailed")}</Alert>
            <Button variant="secondary" onClick={queue.reload}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {!queue.loading && !queue.error && items.length === 0 && <EmptyState title={t("review.empty")} />}

        {!queue.loading && !queue.error && items.length > 0 && (
          <ul className="space-y-4">
            {items.map((item) => {
              const { crop, condition } = splitLabel(item.result_label);
              const typeLabel = TYPE_KEYS.includes(item.diagnosis_type) ? t(`diagnose.type.${item.diagnosis_type}`) : item.diagnosis_type;
              const notesId = `notes-${item.id}`;
              return (
                <li key={item.id}>
                  <Card padded={false} className="p-4 sm:p-5">
                    <div className="flex gap-4">
                      <a href={item.image_url} target="_blank" rel="noopener noreferrer" aria-label={t("review.openImage")} className="shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.image_url} alt="" className="h-24 w-24 rounded-control bg-line/50 object-cover sm:h-28 sm:w-28" />
                      </a>
                      <div className="min-w-0 flex-1">
                        {crop && <p className="text-sm text-ink-soft">{crop}</p>}
                        <p className="font-semibold text-ink [overflow-wrap:anywhere]">{condition}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <SeverityTag severity={item.severity} />
                          <span className="text-sm text-ink-soft">
                            {typeLabel} · {percent(item.confidence_score)}%
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-ink-soft">
                          {item.farmer_name} · {formatDateTime(item.created_at, language)}
                        </p>
                      </div>
                    </div>

                    <label htmlFor={notesId} className="mb-1.5 mt-4 block text-sm font-medium text-ink">
                      {t("review.notesLabel")}
                    </label>
                    <textarea
                      id={notesId}
                      value={notes[item.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                      placeholder={t("review.notesPlaceholder")}
                      rows={2}
                      className="control"
                    />

                    <Button className="mt-3 w-full sm:w-auto" onClick={() => handleVerify(item.id)} loading={submittingId === item.id} disabled={submittingId !== null}>
                      {t("review.markVerified")}
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
