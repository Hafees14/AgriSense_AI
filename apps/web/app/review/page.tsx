"use client";

import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { api } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/useCurrentUser";
import SeverityTag from "@/components/SeverityTag";

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
    return <div className="flex min-h-[50vh] items-center justify-center text-neutral-400">Loading…</div>;
  }
  if (user.role !== "officer") {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center text-neutral-600">
        <p>{t("review.officersOnly")}</p>
      </main>
    );
  }
  return <OfficerPortal />;
}

function OfficerPortal() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<OfficerSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    const data = await api.reviews.queue();
    setItems(data as QueueItem[]);
    setLoading(false);
  }

  async function loadSummary() {
    setSummaryLoading(true);
    const data = await api.reviews.summary();
    setSummary(data as OfficerSummary);
    setSummaryLoading(false);
  }

  useEffect(() => {
    loadQueue();
    loadSummary();
  }, []);

  async function handleVerify(id: string) {
    setSubmittingId(id);
    try {
      await api.reviews.submit(id, notes[id]);
      setItems((prev) => prev.filter((i) => i.id !== id));
      // The region cards' needs_review_count and reviewed_in_window_count
      // are now stale — refresh in the background rather than blocking
      // the "item removed from queue" feedback the officer just got.
      loadSummary();
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold text-primary">🕵️ {t("review.title")}</h1>
      <p className="mb-6 text-sm text-neutral-500">{t("review.subtitle")}</p>

      {/* Top-line stats */}
      {!summaryLoading && summary && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <StatCard label={t("review.statPending")} value={summary.pending_review_count} tone="amber" />
          <StatCard label={t("review.statReviewed")} value={summary.reviewed_in_window_count} tone="green" />
          <StatCard label={t("review.statFarmers")} value={summary.total_farmers} tone="neutral" />
        </div>
      )}

      {/* Area-wise breakdown */}
      {!summaryLoading && summary && summary.regions.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-neutral-700">
            {t("review.byArea")} <span className="text-sm font-normal text-neutral-400">({t("review.last30days")})</span>
          </h2>
          <div className="space-y-2">
            {summary.regions.map((r) => (
              <div key={r.region} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{r.region}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Pill>{r.diagnosis_count} {t("review.reports")}</Pill>
                    {r.needs_review_count > 0 && (
                      <Pill tone="amber">{r.needs_review_count} {t("review.needReview")}</Pill>
                    )}
                    {r.high_severity_count > 0 && (
                      <Pill tone="red">{r.high_severity_count} {t("review.highSeverity")}</Pill>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-neutral-500">
                  🍂 {r.disease_count} {t("review.disease")} · 🐛 {r.pest_count} {t("review.pest")}
                  {r.top_issue && (
                    <>
                      {" · "}
                      {t("review.topIssue")}: <span className="font-medium text-neutral-700">{r.top_issue}</span>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Individual queue */}
      <h2 className="mb-3 text-lg font-semibold text-neutral-700">{t("review.queueHeading")}</h2>

      {loading && <p className="text-neutral-500">Loading…</p>}

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image_url} alt={item.result_label} className="h-24 w-24 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="font-semibold">
                  {item.result_label}{" "}
                  <span className="text-xs font-normal capitalize text-neutral-500">({item.diagnosis_type})</span>
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <SeverityTag severity={item.severity} />
                  <p className="text-sm text-neutral-500">
                    {item.farmer_name} · {(item.confidence_score * 100).toFixed(0)}% confidence
                  </p>
                </div>
                <p className="text-xs text-neutral-400">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            </div>

            <textarea
              value={notes[item.id] ?? ""}
              onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
              placeholder={t("review.notesPlaceholder")}
              rows={2}
              className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />

            <button
              onClick={() => handleVerify(item.id)}
              disabled={submittingId === item.id}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {t("review.markVerified")}
            </button>
          </div>
        ))}

        {!loading && items.length === 0 && (
          <p className="rounded-xl bg-neutral-50 p-6 text-center text-neutral-500">{t("review.empty")}</p>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "amber" | "green" | "neutral" }) {
  const toneClass =
    tone === "amber" ? "bg-amber-50 text-amber-800" : tone === "green" ? "bg-green-50 text-green-800" : "bg-neutral-50 text-neutral-700";
  return (
    <div className={`rounded-xl p-4 text-center ${toneClass}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: "amber" | "red" }) {
  const toneClass = tone === "amber" ? "bg-amber-100 text-amber-800" : tone === "red" ? "bg-red-100 text-red-800" : "bg-neutral-100 text-neutral-600";
  return <span className={`rounded-full px-2 py-0.5 font-medium ${toneClass}`}>{children}</span>;
}