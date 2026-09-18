"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface Hotspot {
  diagnosis_type: string;
  label: string;
  severity: string | null;
  report_count: number;
  latitude: number;
  longitude: number;
  distance_km: number;
  last_reported_at: string;
}

interface Props {
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  hotspots: Hotspot[];
}

// Plain colored circles (not the classic pin icon) so we never need
// Leaflet's default marker image assets, which are notoriously fiddly to
// bundle correctly through webpack/Next.js.
const COLORS: Record<string, string> = {
  disease: "#dc2626", // red-600
  pest: "#ea580c", // orange-600
};

export default function OutbreakMap({ centerLat, centerLon, radiusKm, hotspots }: Props) {
  return (
    <MapContainer
      center={[centerLat, centerLon]}
      zoom={radiusKm > 60 ? 7 : 9}
      scrollWheelZoom
      className="h-[480px] w-full rounded-2xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* The search center — your farm, or your device location */}
      <CircleMarker
        center={[centerLat, centerLon]}
        radius={8}
        pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.9 }}
      >
        <Popup>Your farm</Popup>
      </CircleMarker>

      {hotspots.map((h, i) => (
        <CircleMarker
          key={`${h.diagnosis_type}-${h.label}-${h.latitude}-${h.longitude}-${i}`}
          center={[h.latitude, h.longitude]}
          radius={Math.min(8 + h.report_count * 2, 24)}
          pathOptions={{
            color: COLORS[h.diagnosis_type] ?? "#6b7280",
            fillColor: COLORS[h.diagnosis_type] ?? "#6b7280",
            fillOpacity: 0.45,
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{h.label}</p>
              <p className="capitalize text-neutral-600">{h.diagnosis_type} report</p>
              {h.severity && <p>Severity: {h.severity}</p>}
              <p>
                {h.report_count} farmer{h.report_count > 1 ? "s" : ""} nearby ({h.distance_km} km away)
              </p>
              <p className="text-xs text-neutral-400">
                Last seen {new Date(h.last_reported_at).toLocaleDateString()}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}