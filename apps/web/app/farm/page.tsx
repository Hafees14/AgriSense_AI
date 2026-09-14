"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";

export default function FarmPage() {
  return (
    <AuthGuard>
      <FarmForm />
    </AuthGuard>
  );
}

function FarmForm() {
  const [form, setForm] = useState({ name: "", region: "", land_size_ha: "" });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.farms.create({
        name: form.name,
        region: form.region || undefined,
        land_size_ha: form.land_size_ha ? Number(form.land_size_ha) : undefined,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-primary">Add your farm</h1>
      <p className="mb-6 text-neutral-600">
        This helps AgriSense tailor diagnoses and weather advice to your exact location.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Farm name</label>
          <input
            placeholder="e.g. Kandy home garden"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Region / district</label>
          <input
            placeholder="e.g. Central Province"
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Land size (hectares)</label>
          <input
            type="number"
            placeholder="e.g. 0.5"
            value={form.land_size_ha}
            onChange={(e) => setForm({ ...form, land_size_ha: e.target.value })}
            className="w-full rounded-xl border border-neutral-300 px-4 py-3"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-primary py-3.5 text-lg font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save farm"}
        </button>
        {saved && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">✓ Farm saved.</p>}
      </form>
    </main>
  );
}