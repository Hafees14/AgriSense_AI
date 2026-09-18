"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";
import ExpertBadge from "@/components/ExpertBadge";
import SeverityTag from "@/components/SeverityTag";

interface HistoryItem {
  id: string;
  diagnosis_type: string;
  result_label: string;
  confidence_score: number;
  severity: string | null;
  image_url: string;
  progress_group_id: string | null;
  needs_expert_review: boolean;
  expert_reviewed: boolean;
  created_at: string;
}

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "All" },
  { value: "disease", label: "Disease" },
  { value: "pest", label: "Pest" },
  { value: "plant_id", label: "Plant ID" },
];

export default function HistoryPage() {
  return (
    <AuthGuard>
      <History />
    </AuthGuard>
  );
}

function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    async function loadHistory() {
      const data = await api.diagnoses.history(filter ? { type: filter } : undefined);
      setItems(data as HistoryItem[]);
      setLoading(false);
    }
    loadHistory();
  }, [filter]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-primary">Your diagnosis history</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              filter === f.value ? "bg-primary text-white" : "border border-neutral-300 text-neutral-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-neutral-500">Loading…</p>}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image_url} alt={item.result_label} className="h-16 w-16 rounded-lg object-cover" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.result_label}</p>
                <ExpertBadge needsExpertReview={item.needs_expert_review} expertReviewed={item.expert_reviewed} />
                <SeverityTag severity={item.severity} />
              </div>
              <p className="text-sm text-neutral-500">
                {new Date(item.created_at).toLocaleDateString()} · {(item.confidence_score * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        ))}

        {!loading && items.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-10 text-center">
            <div className="mb-2 text-4xl" aria-hidden>
              📋
            </div>
            <p className="mb-4 text-neutral-600">No diagnoses yet.</p>
            <Link href="/diagnose" className="inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white">
              Diagnose your first plant
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}