"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";

interface Farm {
  id: string;
  name: string;
  region: string | null;
}

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

  useEffect(() => {
    api.farms
      .list()
      .then((data) => setFarms(data as Farm[]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary">Your farms</h1>
        <div className="flex gap-3">
          <Link href="/diagnose" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white">
            📷 Diagnose
          </Link>
          <Link href="/chat" className="rounded-xl border-2 border-primary px-4 py-2.5 text-sm font-semibold text-primary">
            💬 Ask assistant
          </Link>
        </div>
      </div>

      {loading && <p className="text-neutral-500">Loading your farms…</p>}

      {!loading && farms.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-10 text-center">
          <div className="mb-2 text-4xl" aria-hidden>
            🚜
          </div>
          <p className="mb-4 text-neutral-600">You haven&apos;t added a farm yet.</p>
          <Link href="/farm" className="inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white">
            Add your first farm
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {farms.map((farm) => (
          <Link
            key={farm.id}
            href={`/farm?id=${farm.id}`}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm hover:border-primary"
          >
            <h3 className="font-semibold">{farm.name}</h3>
            {farm.region && <p className="text-sm text-neutral-500">{farm.region}</p>}
          </Link>
        ))}
      </div>
    </main>
  );
}