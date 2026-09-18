"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Farm } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <Dashboard />
    </AuthGuard>
  );
}

function Dashboard() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.farms
      .list()
      .then(setFarms)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your farms."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Your farms</h1>
        <div className="flex gap-3">
          <Link href="/diagnose" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-paper">
            Diagnose
          </Link>
          <Link href="/chat" className="rounded-xl border-2 border-primary px-4 py-2.5 text-sm font-semibold text-primary">
            Ask assistant
          </Link>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-2xl bg-paper-raised" />
          <div className="h-24 animate-pulse rounded-2xl bg-paper-raised" />
        </div>
      )}

      {!loading && error && (
        <p role="alert" className="rounded-lg bg-chili-50 p-4 text-sm text-chili-dark">
          {error}
        </p>
      )}

      {!loading && !error && farms.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-line bg-paper-raised p-10 text-center">
          <div className="mb-2 text-4xl" aria-hidden>
            🌾
          </div>
          <p className="mb-4 text-ink-soft">You haven&apos;t added a farm yet.</p>
          <Link href="/farm" className="inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-paper">
            Add your first farm
          </Link>
        </div>
      )}

      {!loading && !error && farms.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {farms.map((farm) => (
            <Link
              key={farm.id}
              href={`/farm?id=${farm.id}`}
              className="flex items-center gap-4 rounded-2xl border border-line bg-paper-raised p-5 shadow-sm hover:border-primary"
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-paper">
                {farm.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={farm.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-soft" aria-hidden>
                    🌾
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-ink">{farm.name}</h3>
                <p className="truncate text-sm text-ink-soft">
                  {[farm.farm_type, farm.region].filter(Boolean).join(" · ") || "No details yet"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}