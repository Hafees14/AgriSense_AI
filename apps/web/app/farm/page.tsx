"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, type Farm, type LocationSource } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";
import { compressImage } from "@/lib/imageCompression";
import { useLanguage } from "@/lib/i18n";
import { formatDate } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import type { LocationValue } from "@/components/FarmLocationPicker";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Field from "@/components/ui/Field";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

// Leaflet touches window/document at import time, so it can never be
// server-rendered — same pattern as the outbreak map.
const FarmLocationPicker = dynamic(() => import("@/components/FarmLocationPicker"), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
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
const EMPTY_LOCATION: LocationValue = { latitude: null, longitude: null, source: null };
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type Errors = { name?: string; land_size_ha?: string; location?: string };

function FarmView() {
  const { t, language } = useLanguage();
  const toast = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const farmId = searchParams.get("id");

  const farms = useLoad(() => api.farms.list());
  const [current, setCurrent] = useState<Farm | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(!!farmId);
  const [loadError, setLoadError] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [location, setLocation] = useState<LocationValue>(EMPTY_LOCATION);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setErrors({});
    setError(null);
    setLoadError(false);
    if (!farmId) {
      setCurrent(null);
      setForm(EMPTY_FORM);
      setLocation(EMPTY_LOCATION);
      setLoadingCurrent(false);
      return;
    }
    let cancelled = false;
    setLoadingCurrent(true);
    api.farms
      .get(farmId)
      .then((farm) => {
        if (cancelled) return;
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
      .catch(() => !cancelled && setLoadError(true))
      .finally(() => !cancelled && setLoadingCurrent(false));
    return () => {
      cancelled = true;
    };
  }, [farmId]);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  function validate(): Errors {
    const e: Errors = {};
    if (!form.name.trim()) e.name = t("farm.err.name");
    if (form.land_size_ha && Number(form.land_size_ha) < 0) e.land_size_ha = t("farm.err.size");
    const { latitude: lat, longitude: lng } = location;
    if ((lat != null && (lat < -90 || lat > 90)) || (lng != null && (lng < -180 || lng > 180))) e.location = t("farm.err.coords");
    return e;
  }

  function apiMessage(err: unknown, fallbackKey: string) {
    if (err instanceof TypeError) return t("error.network");
    const msg = err instanceof Error ? err.message : "";
    if (!msg || msg.includes("[object Object]") || msg.startsWith("Request failed with status")) return t(fallbackKey);
    return msg;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    const found = validate();
    setErrors(found);
    if (found.name || found.land_size_ha) {
      const first = found.name ? "name" : "land_size_ha";
      (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    if (found.location) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
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
        toast(t("farm.saved"), "success");
        farms.reload();
      } else {
        const created = await api.farms.create(payload);
        toast(t("farm.saved"), "success");
        farms.reload();
        router.push(`/farm?id=${created.id}`);
        return;
      }
    } catch (err) {
      setError(apiMessage(err, "farm.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !farmId) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError(t("error.unsupportedType"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(t("error.tooLarge"));
      return;
    }

    setImageError(null);
    setImageUploading(true);
    try {
      const compressed = await compressImage(file);
      const updated = await api.farms.uploadImage(farmId, compressed);
      setCurrent(updated);
      toast(t("farm.photoUpdated"), "success");
      farms.reload();
    } catch (err) {
      setImageError(apiMessage(err, "farm.photoFailed"));
    } finally {
      setImageUploading(false);
    }
  }

  const summaryRows: [string, string][] = current
    ? [
        [t("farm.type"), current.farm_type || "—"],
        [t("farm.crops"), current.main_crops || "—"],
        [
          t("farm.location"),
          current.latitude != null && current.longitude != null ? `${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}` : t("farm.notSet"),
        ],
        [t("farm.lastUpdated"), formatDate(current.updated_at, language)],
      ]
    : [];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold text-primary-dark sm:text-3xl">{farmId ? t("farm.titleEdit") : t("dashboard.addFarm")}</h1>
        {farmId && (
          <Link href="/farm" className="inline-flex min-h-touch items-center rounded-control px-2 font-medium text-primary-dark underline underline-offset-2 hover:text-primary">
            {t("farm.addAnother")}
          </Link>
        )}
      </div>

      {loadingCurrent ? (
        <Skeleton className="h-64 w-full" />
      ) : loadError ? (
        <Alert>{t("farm.loadFailed")}</Alert>
      ) : (
        <div className="grid gap-8 sm:grid-cols-[1fr,1.1fr]">
          {current && (
            <div className="order-2 space-y-4 sm:order-1">
              <Card padded={false} className="overflow-hidden">
                {current.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.image_url} alt={current.name} className="h-40 w-full object-cover" />
                ) : (
                  <div aria-hidden="true" className="flex h-40 w-full items-center justify-center bg-primary-50 text-4xl font-semibold text-primary-dark">
                    {current.name.trim().charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="p-4">
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()} loading={imageUploading}>
                    {imageUploading ? t("farm.uploading") : current.image_url ? t("farm.changePhoto") : t("farm.addPhoto")}
                  </Button>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" aria-hidden="true" tabIndex={-1} />
                  {imageError && (
                    <p role="alert" className="mt-2 text-sm font-medium text-chili-dark">
                      {imageError}
                    </p>
                  )}
                </div>
              </Card>

              <Card as="section" padded={false} className="p-4">
                <dl className="space-y-3 text-[0.95rem]">
                  {summaryRows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-ink-soft">{label}</dt>
                      <dd className="text-right font-medium text-ink [overflow-wrap:anywhere]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="order-1 space-y-5 sm:order-2">
            {error && <Alert>{error}</Alert>}

            <Field name="name" label={t("farm.name")} placeholder={t("farm.namePh")} value={form.name} onChange={set("name")} error={errors.name} required autoComplete="off" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field name="farm_type" label={t("farm.type")} placeholder={t("farm.typePh")} value={form.farm_type} onChange={set("farm_type")} />
              <Field
                name="land_size_ha"
                type="number"
                step="any"
                min={0}
                inputMode="decimal"
                label={t("farm.size")}
                placeholder={t("farm.sizePh")}
                value={form.land_size_ha}
                onChange={set("land_size_ha")}
                error={errors.land_size_ha}
              />
            </div>
            <Field name="main_crops" label={t("farm.crops")} placeholder={t("farm.cropsPh")} value={form.main_crops} onChange={set("main_crops")} />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field name="region" label={t("farm.region")} placeholder={t("farm.regionPh")} value={form.region} onChange={set("region")} />
              <Field
                name="address"
                label={`${t("farm.address")} ${t("register.optional")}`}
                placeholder={t("farm.addressPh")}
                value={form.address}
                onChange={set("address")}
                autoComplete="street-address"
              />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-ink">{t("farm.location")}</p>
              <FarmLocationPicker value={location} onChange={setLocation} />
              {errors.location && (
                <p role="alert" className="mt-2 text-sm font-medium text-chili-dark">
                  {errors.location}
                </p>
              )}
            </div>

            <Button type="submit" size="lg" loading={saving} className="w-full">
              {saving ? t("farm.saving") : farmId ? t("farm.save") : t("farm.create")}
            </Button>
          </form>
        </div>
      )}

      <section className="mt-12" aria-labelledby="your-farms">
        <h2 id="your-farms" className="mb-3 text-xl font-semibold text-ink">
          {t("dashboard.farms")}
        </h2>
        {farms.loading && <Skeleton className="h-16 w-full" />}
        {!farms.loading && farms.error && (
          <div className="space-y-3">
            <Alert>{t("dashboard.loadFarmsFailed")}</Alert>
            <Button variant="secondary" onClick={farms.reload}>
              {t("common.retry")}
            </Button>
          </div>
        )}
        {!farms.loading && !farms.error && (farms.data ?? []).length === 0 && <EmptyState title={t("farm.listEmpty")} />}
        {!farms.loading && !farms.error && (farms.data ?? []).length > 0 && (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(farms.data ?? []).map((farm) => (
              <li key={farm.id}>
                <Link
                  href={`/farm?id=${farm.id}`}
                  aria-current={farm.id === farmId ? "page" : undefined}
                  className={`flex min-h-touch items-center gap-3 rounded-card border p-3 transition-colors hover:border-primary ${
                    farm.id === farmId ? "border-primary bg-primary-50" : "border-line bg-paper-raised"
                  }`}
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-control bg-primary-50">
                    {farm.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={farm.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div aria-hidden="true" className="flex h-full w-full items-center justify-center font-semibold text-primary-dark">
                        {farm.name.trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{farm.name}</p>
                    <p className="truncate text-sm text-ink-soft">{farm.region || farm.farm_type || t("dashboard.noDetails")}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
