"use client";

import { useCallback, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { LocationSource } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import Button from "@/components/ui/Button";

// Leaflet's default marker icon references image files by a relative path
// that breaks under bundlers unless re-pointed at CDN-hosted copies — a
// well-known react-leaflet gotcha, not a design choice.
const markerIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const DEFAULT_CENTER: [number, number] = [7.8731, 80.7718]; // Sri Lanka, roughly centered

export interface LocationValue {
  latitude: number | null;
  longitude: number | null;
  source: LocationSource | null;
}

interface Props {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
}

function ClickToPlace({ onPlace }: { onPlace: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPlace(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function FarmLocationPicker({ value, onChange }: Props) {
  const { t } = useLanguage();
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const center = useMemo<[number, number]>(
    () => (value.latitude != null && value.longitude != null ? [value.latitude, value.longitude] : DEFAULT_CENTER),
    // Only re-center the map when we don't yet have a pin — once a pin
    // exists, dragging it shouldn't cause the whole map to jump/recenter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const place = useCallback(
    (lat: number, lng: number, source: LocationSource) => {
      setGeoError(null);
      onChange({ latitude: Math.round(lat * 1e6) / 1e6, longitude: Math.round(lng * 1e6) / 1e6, source });
    },
    [onChange]
  );

  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError(t("picker.noGeo"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        place(pos.coords.latitude, pos.coords.longitude, "gps");
        setLocating(false);
      },
      (err) => {
        setGeoError(err.code === err.PERMISSION_DENIED ? t("picker.denied") : t("picker.failed"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <div className="space-y-2">
      <div role="region" aria-label={t("picker.mapLabel")} className="overflow-hidden rounded-card border border-line">
        <MapContainer center={center} zoom={value.latitude != null ? 14 : 7} style={{ height: 260, width: "100%" }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPlace={(lat, lng) => place(lat, lng, "manual")} />
          {value.latitude != null && value.longitude != null && (
            <Marker
              position={[value.latitude, value.longitude]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const pos = m.getLatLng();
                  place(pos.lat, pos.lng, "manual");
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="secondary" onClick={useMyLocation} loading={locating}>
          {locating ? t("picker.locating") : t("picker.useMyLocation")}
        </Button>
        {value.source && (
          <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-dark">
            {value.source === "gps" ? t("picker.src.gps") : value.source === "geocoded" ? t("picker.src.geocoded") : t("picker.src.manual")}
          </span>
        )}
      </div>
      {geoError && (
        <p role="alert" className="text-sm font-medium text-chili-dark">
          {geoError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="farm-lat" className="mb-1.5 block text-sm font-medium text-ink">
            {t("picker.latitude")}
          </label>
          <input
            id="farm-lat"
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            value={value.latitude ?? ""}
            onChange={(e) => {
              const lat = e.target.value === "" ? null : Number(e.target.value);
              onChange({ ...value, latitude: lat, source: "manual" });
            }}
            className="control"
          />
        </div>
        <div>
          <label htmlFor="farm-lng" className="mb-1.5 block text-sm font-medium text-ink">
            {t("picker.longitude")}
          </label>
          <input
            id="farm-lng"
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            value={value.longitude ?? ""}
            onChange={(e) => {
              const lng = e.target.value === "" ? null : Number(e.target.value);
              onChange({ ...value, longitude: lng, source: "manual" });
            }}
            className="control"
          />
        </div>
      </div>
      <p className="text-sm text-ink-soft">{t("picker.help")}</p>
    </div>
  );
}