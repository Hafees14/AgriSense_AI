"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { api, type GeolocationCoords } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";
import { useLanguage } from "@/lib/i18n";
import type { Hotspot } from "@/components/OutbreakMap";

// Leaflet touches window/document at import time, so it can never be
// server-rendered — load it client-side only.
const OutbreakMap = dynamic(() => import("@/components/OutbreakMap"), { ssr: false });

interface Farm {
  id: string;
  name: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
}

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
  const { t } = useLanguage();
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const [deviceCoords, setDeviceCoords] = useState<GeolocationCoords | null>(null);
  const [radiusKm, setRadiusKm] = useState(100);
  const [data, setData] = useState<OutbreakMapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.farms.list().then((list) => {
      const farmList = list as Farm[];
      setFarms(farmList);
      const withCoords = farmList.find((f) => f.latitude != null && f.longitude != null);
      if (withCoords) setSelectedFarmId(withCoords.id);
    });
  }, []);

  // Fall back to the device's own location if no farm has coordinates set.
  useEffect(() => {
    if (selectedFarmId || typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setDeviceCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => setDeviceCoords(null),
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, [selectedFarmId]);

  useEffect(() => {
    if (!selectedFarmId && !deviceCoords) return;

    setLoading(true);
    setError(null);
    const params: Record<string, string> = { radius_km: String(radiusKm) };
    if (selectedFarmId) {
      params.farm_id = selectedFarmId;
    } else if (deviceCoords) {
      params.latitude = String(deviceCoords.latitude);
      params.longitude = String(deviceCoords.longitude);
    }

    api.outbreaks
      .list(params)
      .then((res) => setData(res as OutbreakMapResponse))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load the outbreak map."))
      .finally(() => setLoading(false));
  }, [selectedFarmId, deviceCoords, radiusKm]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-primary">🗺️ {t("outbreaks.title")}</h1>
      <p className="mb-6 text-neutral-600">{t("outbreaks.subtitle")}</p>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {farms.length > 0 && (
          <select
            value={selectedFarmId}
            onChange={(e) => setSelectedFarmId(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          >
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id} disabled={farm.latitude == null}>
                {farm.name}
                {farm.latitude == null ? " (no location set)" : ""}
              </option>
            ))}
          </select>
        )}

        <select
          value={radiusKm}
          onChange={(e) => setRadiusKm(Number(e.target.value))}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r} value={r}>
              Within {r} km
            </option>
          ))}
        </select>
      </div>

      {!selectedFarmId && !deviceCoords && !loading && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Add a farm location, or allow location access, to see reports near you.
        </p>
      )}

      {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && (
        <>
          <OutbreakMap
            centerLat={data.center_latitude}
            centerLon={data.center_longitude}
            radiusKm={data.radius_km}
            hotspots={data.hotspots}
          />

          <div className="mt-6">
            <h2 className="mb-2 font-semibold text-neutral-700">
              {data.hotspots.length === 0
                ? "No nearby reports in this window — good sign."
                : `${data.hotspots.length} nearby hotspot${data.hotspots.length > 1 ? "s" : ""}`}
            </h2>
            <div className="space-y-2">
              {data.hotspots.map((h, i) => (
                <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">
                      {h.label}{" "}
                      <span className="text-xs font-normal capitalize text-neutral-500">({h.diagnosis_type})</span>
                    </p>
                    <span className="text-xs text-neutral-400">{h.distance_km} km away</span>
                  </div>
                  <p className="text-sm text-neutral-600">
                    {h.report_count} farmer{h.report_count > 1 ? "s" : ""} reported nearby · last seen{" "}
                    {new Date(h.last_reported_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {loading && <p className="text-neutral-500">Loading map…</p>}
    </main>
  );
}