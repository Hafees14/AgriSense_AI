"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api, type Farm, type GeolocationCoords } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";
import { useLanguage } from "@/lib/i18n";
import { formatDate, splitLabel } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import type { Hotspot } from "@/components/OutbreakMap";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";

// Leaflet touches window/document at import time, so it can never be
// server-rendered — load it client-side only.
const OutbreakMap = dynamic(() => import("@/components/OutbreakMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full sm:h-[480px]" />,
});

interface OutbreakMapResponse {
  center_latitude: number;
  center_longitude: number;
  radius_km: number;
  generated_at: string;
  hotspots: Hotspot[];
}

const RADIUS_OPTIONS = [25, 50, 100, 200];

export default function OutbreaksPage() {
  return (
    <AuthGuard>
      <OutbreaksView />
    </AuthGuard>
  );
}

function OutbreaksView() {
  const { t, language } = useLanguage();
  const farmsLoad = useLoad(() => api.farms.list());
  const farms: Farm[] = farmsLoad.data ?? [];
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [deviceCoords, setDeviceCoords] = useState<GeolocationCoords | null>(null);
  const [radiusKm, setRadiusKm] = useState(100);

  // Default to the first farm that has coordinates.
  useEffect(() => {
    if (!farmsLoad.data) return;
    const withCoords = farmsLoad.data.find((f) => f.latitude != null && f.longitude != null);
    if (withCoords) setSelectedFarmId((cur) => cur || withCoords.id);
  }, [farmsLoad.data]);

  // Fall back to the device's own location if no farm has coordinates set.
  useEffect(() => {
    if (farmsLoad.loading || selectedFarmId || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setDeviceCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setDeviceCoords(null),
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, [selectedFarmId, farmsLoad.loading]);

  const hasOrigin = Boolean(selectedFarmId || deviceCoords);
  const { data, loading, error, reload } = useLoad<OutbreakMapResponse | null>(async () => {
    if (!hasOrigin) return null;
    const params: Record<string, string> = { radius_km: String(radiusKm) };
    if (selectedFarmId) params.farm_id = selectedFarmId;
    else if (deviceCoords) {
      params.latitude = String(deviceCoords.latitude);
      params.longitude = String(deviceCoords.longitude);
    }
    return (await api.outbreaks.list(params)) as OutbreakMapResponse;
  }, [selectedFarmId, deviceCoords, radiusKm]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold text-primary-dark sm:text-3xl">{t("outbreaks.title")}</h1>
      <p className="mt-1.5 text-ink-soft">{t("outbreaks.subtitle")}</p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {farms.length > 0 && (
          <Select label={t("outbreaks.farmLabel")} value={selectedFarmId} onChange={(e) => setSelectedFarmId(e.target.value)}>
            {!selectedFarmId && <option value="" />}
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id} disabled={farm.latitude == null}>
                {farm.name}
                {farm.latitude == null ? t("outbreaks.noLocationFarm") : ""}
              </option>
            ))}
          </Select>
        )}
        <Select label={t("outbreaks.radiusLabel")} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))}>
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {t("outbreaks.radiusOption").replace("{n}", String(r))}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-5" aria-busy={loading}>
        {!hasOrigin && !farmsLoad.loading && (
          <div className="space-y-3">
            <Alert tone="warning">{t("outbreaks.needLocation")}</Alert>
            <Link href="/farm" className="inline-flex min-h-touch items-center rounded-control bg-primary px-4 font-medium text-paper-raised hover:bg-primary-dark">
              {t("outbreaks.addFarmLocation")}
            </Link>
          </div>
        )}

        {hasOrigin && error && (
          <div className="space-y-3">
            <Alert>{t("outbreaks.loadFailed")}</Alert>
            <Button variant="secondary" onClick={reload}>
              {t("common.retry")}
            </Button>
          </div>
        )}

        {hasOrigin && loading && !data && <Skeleton className="h-[340px] w-full sm:h-[480px]" />}

        {data && (
          <>
            <OutbreakMap centerLat={data.center_latitude} centerLon={data.center_longitude} radiusKm={data.radius_km} hotspots={data.hotspots} />

            <section className="mt-8" aria-labelledby="hotspots-heading">
              <h2 id="hotspots-heading" className="text-xl font-semibold text-ink">
                {data.hotspots.length === 0 ? t("outbreaks.none") : t("outbreaks.count").replace("{n}", String(data.hotspots.length))}
              </h2>
              {data.hotspots.length === 0 && <p className="mt-2 text-ink-soft">{t("outbreaks.noneNote")}</p>}
              <ul className="mt-3 space-y-3">
                {data.hotspots.map((h, i) => {
                  const { crop, condition } = splitLabel(h.label);
                  return (
                    <li key={i}>
                      <Card padded={false} className="p-4">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p className="font-semibold text-ink [overflow-wrap:anywhere]">
                            {crop ? `${crop}: ` : ""}
                            {condition}{" "}
                            <span className="text-sm font-normal text-ink-soft">
                              ({h.diagnosis_type === "pest" ? t("outbreaks.legend.pest") : t("outbreaks.legend.disease")})
                            </span>
                          </p>
                          <span className="text-sm text-ink-soft">{t("outbreaks.away").replace("{n}", String(h.distance_km))}</span>
                        </div>
                        <p className="mt-1 text-sm text-ink-soft">
                          {t("outbreaks.reporters").replace("{n}", String(h.report_count)).replace("{date}", formatDate(h.last_reported_at, language))}
                        </p>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
