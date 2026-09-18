"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type Farm, type LocationSource } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";
import { compressImage } from "@/lib/imageCompression";
import type { LocationValue } from "@/components/FarmLocationPicker";

// Leaflet touches window/document at import time, so it can never be
// server-rendered — same pattern as the outbreak map.
const FarmLocationPicker = dynamic(() => import("@/components/FarmLocationPicker"), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-lg bg-paper-raised" />,
});

export default function FarmPage() {
  return (
    <AuthGuard>
      <FarmView />
    </AuthGuard>
  );
}

interface FormState {
  name: string;
  region: string;
  address: string;
  land_size_ha: string;
  farm_type: string;
  main_crops: string;
}

const EMPTY_FORM: FormState = { name: "", region: "", address: "", land_size_ha: "", farm_type: "", main_crops: "" };

function FarmView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const farmId = searchParams.get("id");

  const [farms, setFarms] = useState<Farm[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [current, setCurrent] = useState<Farm | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(!!farmId);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [location, setLocation] = useState<LocationValue>({ latitude: null, longitude: null, source: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFarms = useCallback(() => {
    setLoadingList(true);
    setListError(null);
    api.farms
      .list()
      .then(setFarms)
      .catch((err) => setListError(err instanceof Error ? err.message : "Couldn't load your farms."))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  useEffect(() => {
    if (!farmId) {
      setCurrent(null);
      setForm(EMPTY_FORM);
      setLocation({ latitude: null, longitude: null, source: null });
      return;
    }
    setLoadingCurrent(true);
    setError(null);
    api.farms
      .get(farmId)
      .then((farm) => {
        setCurrent(farm);
        setForm({
          name: farm.name,
          region: farm.region ?? "",
          address: farm.address ?? "",
          land_size_ha: farm.land_size_ha != null ? String(farm.land_size_ha) : "",
          farm_type: farm.farm_type ?? "",
          main_crops: farm.main_crops ?? "",
        });
        setLocation({
          latitude: farm.latitude ?? null,
          longitude: farm.longitude ?? null,
          source: (farm.location_source as LocationSource | undefined) ?? null,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this farm."))
      .finally(() => setLoadingCurrent(false));
  }, [farmId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      region: form.region || undefined,
      address: form.address || undefined,
      land_size_ha: form.land_size_ha ? Number(form.land_size_ha) : undefined,
      farm_type: form.farm_type || undefined,
      main_crops: form.main_crops || undefined,
      latitude: location.latitude ?? undefined,
      longitude: location.longitude ?? undefined,
      location_source: location.source ?? undefined,
    };
    try {
      if (farmId) {
        const updated = await api.farms.update(farmId, payload);
        setCurrent(updated);
      } else {
        const created = await api.farms.create(payload);
        loadFarms();
        router.push(`/farm?id=${created.id}`);
        return;
      }
      loadFarms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your farm. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !farmId) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Please choose a JPEG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageError("Image is too large — please choose one under 10MB.");
      return;
    }

    setImageError(null);
    setImageUploading(true);
    try {
      const compressed = await compressImage(file);
      const updated = await api.farms.uploadImage(farmId, compressed);
      setCurrent(updated);
      loadFarms();
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Couldn't upload the photo. Please try again.");
    } finally {
      setImageUploading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold text-ink">{farmId ? "Edit farm" : "Add a farm"}</h1>
        {farmId && (
          <Link href="/farm" className="text-sm font-medium text-primary hover:underline">
            + Add another farm
          </Link>
        )}
      </div>

      {loadingCurrent ? (
        <div className="h-64 animate-pulse rounded-lg bg-paper-raised" />
      ) : (
        <div className="grid gap-8 sm:grid-cols-[1fr,1.1fr]">
          {/* Structured summary card — shown once a farm exists */}
          {current && (
            <div className="order-2 space-y-4 sm:order-1">
              <div className="overflow-hidden rounded-lg border border-line bg-paper-raised">
                {current.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.image_url} alt={current.name} className="h-40 w-full object-cover" />
                ) : (
                  <div className="flex h-40 w-full items-center justify-center text-ink-soft">
                    <span aria-hidden className="text-3xl">
                      🌾
                    </span>
                  </div>
                )}
                <div className="p-4">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={imageUploading}
                    className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {imageUploading ? "Uploading…" : current.image_url ? "Change photo" : "Add a photo"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  {imageError && <p className="mt-1 text-sm text-chili">{imageError}</p>}
                </div>
              </div>

              <dl className="space-y-2 rounded-lg border border-line bg-paper-raised p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Farm type</dt>
                  <dd className="text-right font-medium">{current.farm_type || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Main crops</dt>
                  <dd className="text-right font-medium">{current.main_crops || "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Location</dt>
                  <dd className="text-right font-medium">
                    {current.latitude != null && current.longitude != null
                      ? `${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}`
                      : "Not set"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-soft">Last updated</dt>
                  <dd className="text-right font-medium">{new Date(current.updated_at).toLocaleDateString()}</dd>
                </div>
              </dl>
            </div>
          )}

          {/* Editable form */}
          <form onSubmit={handleSubmit} className="order-1 space-y-4 sm:order-2">
            {error && <p className="rounded-lg bg-chili-50 p-3 text-sm text-chili-dark">{error}</p>}

            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Farm name</label>
              <input
                placeholder="e.g. Kandy home garden"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-line bg-paper-raised px-4 py-2.5"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-soft">Farm type</label>
                <input
                  placeholder="e.g. Paddy, home garden"
                  value={form.farm_type}
                  onChange={(e) => setForm({ ...form, farm_type: e.target.value })}
                  className="w-full rounded-lg border border-line bg-paper-raised px-4 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-soft">Land size (ha)</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  placeholder="e.g. 0.5"
                  value={form.land_size_ha}
                  onChange={(e) => setForm({ ...form, land_size_ha: e.target.value })}
                  className="w-full rounded-lg border border-line bg-paper-raised px-4 py-2.5"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Main crops</label>
              <input
                placeholder="e.g. Rice, tomato, chilli"
                value={form.main_crops}
                onChange={(e) => setForm({ ...form, main_crops: e.target.value })}
                className="w-full rounded-lg border border-line bg-paper-raised px-4 py-2.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-soft">Region / district</label>
                <input
                  placeholder="e.g. Central Province"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  className="w-full rounded-lg border border-line bg-paper-raised px-4 py-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-soft">Address (optional)</label>
                <input
                  placeholder="Street / village"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-lg border border-line bg-paper-raised px-4 py-2.5"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink-soft">Exact location</label>
              <FarmLocationPicker value={location} onChange={setLocation} />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-primary py-3 text-base font-semibold text-paper disabled:opacity-50"
            >
              {saving ? "Saving…" : farmId ? "Save changes" : "Save farm"}
            </button>
          </form>
        </div>
      )}

      <div className="mt-12">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Your farms</h2>
        {loadingList && <p className="text-sm text-ink-soft">Loading…</p>}
        {listError && <p className="text-sm text-chili">{listError}</p>}
        {!loadingList && !listError && farms.length === 0 && (
          <p className="text-sm text-ink-soft">No farms yet — add your first one above.</p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {farms.map((farm) => (
            <Link
              key={farm.id}
              href={`/farm?id=${farm.id}`}
              className={`flex items-center gap-3 rounded-lg border p-3 hover:border-primary ${
                farm.id === farmId ? "border-primary bg-primary-50" : "border-line bg-paper-raised"
              }`}
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-paper">
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
                <p className="truncate font-medium text-ink">{farm.name}</p>
                <p className="truncate text-xs text-ink-soft">{farm.region || farm.farm_type || "No details yet"}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}