"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage } from "@/lib/i18n";
import { formatDate, splitLabel } from "@/lib/format";

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
// Disease = chili, pest = monsoon blue (clearly different hues); "you" = paddy green.
export const MARKER_COLORS = { disease: "#A6432E", pest: "#315B7D", center: "#2F6B3D", other: "#4A5A4C" };

export default function OutbreakMap({ centerLat, centerLon, radiusKm, hotspots }: Props) {
  const { t, language } = useLanguage();
  const colorFor = (type: string) => (type === "disease" ? MARKER_COLORS.disease : type === "pest" ? MARKER_COLORS.pest : MARKER_COLORS.other);

  return (
    <div role="region" aria-label={t("outbreaks.mapLabel")}>
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={radiusKm > 60 ? 7 : 9}
        scrollWheelZoom
        className="h-[340px] w-full rounded-card border border-line sm:h-[480px]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* The search center — your farm, or your device location */}
        <CircleMarker
          center={[centerLat, centerLon]}
          radius={8}
          pathOptions={{ color: MARKER_COLORS.center, fillColor: MARKER_COLORS.center, fillOpacity: 0.9 }}
        >
          <Popup>{t("outbreaks.legend.you")}</Popup>
        </CircleMarker>

        {hotspots.map((h, i) => {
          const { condition } = splitLabel(h.label);
          return (
            <CircleMarker
              key={`${h.diagnosis_type}-${h.label}-${h.latitude}-${h.longitude}-${i}`}
              center={[h.latitude, h.longitude]}
              radius={Math.min(8 + h.report_count * 2, 24)}
              pathOptions={{ color: colorFor(h.diagnosis_type), fillColor: colorFor(h.diagnosis_type), fillOpacity: 0.45 }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{condition}</p>
                  <p>{h.diagnosis_type === "pest" ? t("outbreaks.legend.pest") : t("outbreaks.legend.disease")}</p>
                  {h.severity && (
                    <p>
                      {t("outbreaks.severityLabel")}: {h.severity}
                    </p>
                  )}
                  <p>{t("outbreaks.away").replace("{n}", String(h.distance_km))}</p>
                  <p>{t("outbreaks.reporters").replace("{n}", String(h.report_count)).replace("{date}", formatDate(h.last_reported_at, language))}</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft" aria-label={t("outbreaks.legend")}>
        {[
          [MARKER_COLORS.center, t("outbreaks.legend.you")],
          [MARKER_COLORS.disease, t("outbreaks.legend.disease")],
          [MARKER_COLORS.pest, t("outbreaks.legend.pest")],
        ].map(([color, label]) => (
          <li key={label} className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
