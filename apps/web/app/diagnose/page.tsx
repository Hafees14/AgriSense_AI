"use client";

import { useState } from "react";
import { api, type GeolocationCoords } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";

// Nearby-outbreak alerts (disease/pest reports above 90% confidence within
// 100 km) depend on knowing where this diagnosis was taken. Browser
// geolocation is best-effort: if the farmer denies the permission prompt or
// the device has no GPS, we still submit the diagnosis — it just won't be
// eligible to trigger or receive location-based alerts.
function getDeviceLocation(): Promise<GeolocationCoords | undefined> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(undefined);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 },
    );
  });
}

type DiagnosisType = "plant_id" | "disease" | "pest";

interface DiagnosisResult {
  result_label: string;
  confidence_score: number;
  severity: string | null;
  organic_treatment?: string;
  chemical_treatment?: string;
  prevention_tips?: string;
  retry_guidance?: string | null;
  heatmap_url?: string | null;
  weather_advisory?: string | null;
}

const TYPE_OPTIONS: { value: DiagnosisType; label: string; emoji: string }[] = [
  { value: "disease", label: "Disease", emoji: "🍂" },
  { value: "pest", label: "Pest", emoji: "🐛" },
  { value: "plant_id", label: "Plant ID", emoji: "🌱" },
];

export default function DiagnosePage() {
  return (
    <AuthGuard>
      <DiagnoseForm />
    </AuthGuard>
  );
}

function DiagnoseForm() {
  const [type, setType] = useState<DiagnosisType>("disease");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setError(null);
    setPreview(selected ? URL.createObjectURL(selected) : null);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const coords = await getDeviceLocation();
      const response =
        type === "plant_id"
          ? await api.diagnoses.identifyPlant(file, coords)
          : type === "disease"
            ? await api.diagnoses.detectDisease(file, undefined, undefined, coords)
            : await api.diagnoses.detectPest(file, undefined, coords);
      setResult(response as DiagnosisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't complete the diagnosis. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-bold text-primary">What do you want to check?</h1>
      <p className="mb-6 text-neutral-600">Choose a type, then take or upload a clear, close-up photo.</p>

      <div className="mb-6 grid grid-cols-3 gap-2">
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setType(opt.value)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 py-4 text-sm font-semibold transition ${
              type === opt.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-neutral-200 text-neutral-500 hover:border-neutral-300"
            }`}
          >
            <span className="text-2xl" aria-hidden>
              {opt.emoji}
            </span>
            {opt.label}
          </button>
        ))}
      </div>

      <label className="flex min-h-[240px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-white p-6 text-center hover:border-primary">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected preview" className="max-h-64 rounded-lg object-contain" />
        ) : (
          <>
            <span className="text-4xl" aria-hidden>
              📷
            </span>
            <span className="font-medium text-neutral-600">Tap to take a photo or upload an image</span>
            <span className="text-sm text-neutral-400">Get close — fill the frame with the leaf, fruit, or pest</span>
          </>
        )}
        <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
      </label>

      <button
        onClick={handleSubmit}
        disabled={!file || loading}
        className="mt-4 w-full rounded-xl bg-primary py-4 text-lg font-semibold text-white shadow-sm disabled:opacity-50"
      >
        {loading ? "Analyzing…" : "Get my diagnosis"}
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {result && (
        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">{result.result_label}</h2>
            <span className="text-sm text-neutral-500">{(result.confidence_score * 100).toFixed(0)}% confidence</span>
          </div>

          {result.severity && (
            <p className="mb-3 inline-block rounded-full bg-earth/20 px-3 py-1 text-xs font-medium text-earth">
              Severity: {result.severity}
            </p>
          )}

          {result.retry_guidance && (
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{result.retry_guidance}</p>
          )}

          {result.weather_advisory && (
            <p className="mb-3 flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">
              <span aria-hidden>⛅</span> {result.weather_advisory}
            </p>
          )}

          {result.organic_treatment && <TreatmentBlock title="🌿 Organic treatment" content={result.organic_treatment} />}
          {result.chemical_treatment && <TreatmentBlock title="🧪 Chemical treatment" content={result.chemical_treatment} />}
          {result.prevention_tips && <TreatmentBlock title="🛡️ Prevention" content={result.prevention_tips} />}
        </div>
      )}
    </main>
  );
}

function TreatmentBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="mt-4 border-t border-neutral-100 pt-4">
      <h3 className="text-sm font-semibold text-neutral-700">{title}</h3>
      <p className="mt-1 text-neutral-600">{content}</p>
    </div>
  );
}