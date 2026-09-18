"use client";

import { useCallback, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { LocationSource } from "@/lib/api-client";

// Leaflet's default marker icon references image files by a relative path
// that breaks under bundlers unless re-pointed at CDN-hosted copies — a
// well-known react-leaflet gotcha, not a design choice.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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
      setGeoError("Geolocation isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        place(pos.coords.latitude, pos.coords.longitude, "gps");
        setLocating(false);
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied — place the pin manually instead."
            : "Couldn't get your location. Place the pin manually instead."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-line">
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
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="rounded-full border border-line px-3 py-1.5 font-medium text-ink-soft hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {locating ? "Locating…" : "📍 Use my location"}
        </button>
        {value.source && (
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-dark">
            {value.source === "gps" ? "From device GPS" : value.source === "geocoded" ? "Approximate (from address)" : "Manually placed"}
          </span>
        )}
      </div>
      {geoError && <p className="text-sm text-chili">{geoError}</p>}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Latitude</label>
          <input
            type="number"
            step="any"
            min={-90}
            max={90}
            value={value.latitude ?? ""}
            onChange={(e) => {
              const lat = e.target.value === "" ? null : Number(e.target.value);
              onChange({ ...value, latitude: lat, source: "manual" });
            }}
            className="w-full rounded border border-line bg-paper-raised px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Longitude</label>
          <input
            type="number"
            step="any"
            min={-180}
            max={180}
            value={value.longitude ?? ""}
            onChange={(e) => {
              const lng = e.target.value === "" ? null : Number(e.target.value);
              onChange({ ...value, longitude: lng, source: "manual" });
            }}
            className="w-full rounded border border-line bg-paper-raised px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>
      <p className="text-xs text-ink-soft">Click the map, drag the pin, type coordinates directly, or use your device's GPS.</p>
    </div>
  );
}