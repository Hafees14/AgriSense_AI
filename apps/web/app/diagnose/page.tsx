"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, type GeolocationCoords } from "@/lib/api-client";
import AuthGuard from "@/components/AuthGuard";
import { useLanguage } from "@/lib/i18n";
import { enqueueDiagnosis } from "@/lib/offlineQueue";
import OfflineQueueBanner from "@/components/OfflineQueueBanner";
import ExpertBadge from "@/components/ExpertBadge";
import SeverityTag from "@/components/SeverityTag";
import { compressImage } from "@/lib/imageCompression";
import { splitLabel } from "@/lib/format";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

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
  needs_expert_review: boolean;
  expert_reviewed: boolean;
  organic_treatment?: string;
  chemical_treatment?: string;
  prevention_tips?: string;
  retry_guidance?: string | null;
  heatmap_url?: string | null;
  weather_advisory?: string | null;
}

const TYPES: DiagnosisType[] = ["disease", "pest", "plant_id"];

// Mirrors apps/api/services/storage_service.py (ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE_BYTES).
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function DiagnosePage() {
  return (
    <AuthGuard>
      <DiagnoseForm />
    </AuthGuard>
  );
}

function DiagnoseForm() {
  const { t } = useLanguage();
  const [type, setType] = useState<DiagnosisType>("disease");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "preparing" | "analyzing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const loading = phase !== "idle";

  // Create the preview URL here (not in the change handler) so it is always revoked.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Move focus to the result so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (result) resultHeadingRef.current?.focus();
  }, [result]);

  function reset() {
    setResult(null);
    setError(null);
    setQueuedMessage(null);
  }

  function acceptFile(selected: File | null) {
    reset();
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setFile(null);
      setError(t("error.unsupportedType"));
      return;
    }
    setFile(selected);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    acceptFile(e.target.files?.[0] ?? null);
    e.target.value = ""; // allow picking the same file again
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!loading) acceptFile(e.dataTransfer.files?.[0] ?? null);
  }

  function errorMessage(err: unknown): string {
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("Unsupported file type")) return t("error.unsupportedType");
    if (msg.includes("exceeds 10MB")) return t("error.tooLarge");
    if (!msg || msg.includes("[object Object]") || msg.startsWith("Request failed with status")) return t("error.diagnoseFailed");
    return msg;
  }

  async function handleSubmit() {
    if (!file || loading) return;
    setPhase("preparing");
    setError(null);
    setQueuedMessage(null);
    setResult(null);
    const [coords, uploadFile] = await Promise.all([getDeviceLocation(), compressImage(file)]);

    if (uploadFile.size > MAX_BYTES) {
      setError(t("error.tooLarge"));
      setPhase("idle");
      return;
    }

    // No point even attempting the request if the device is already known
    // to be offline — queue immediately instead of waiting for a fetch to
    // time out.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await enqueueDiagnosis({ diagnosisType: type, imageBlob: uploadFile, fileName: uploadFile.name, fileType: uploadFile.type, coords });
      setQueuedMessage(t("offline.queuedMessage"));
      setPhase("idle");
      return;
    }

    setPhase("analyzing");
    try {
      const response =
        type === "plant_id"
          ? await api.diagnoses.identifyPlant(uploadFile, coords)
          : type === "disease"
            ? await api.diagnoses.detectDisease(uploadFile, undefined, undefined, coords)
            : await api.diagnoses.detectPest(uploadFile, undefined, coords);
      setResult(response as DiagnosisResult);
    } catch (err) {
      // A thrown TypeError from fetch (as opposed to an HTTP error response,
      // which api-client turns into a regular Error with a message) means
      // the request never reached the server — a dropped connection mid
      // photo-upload, not a rejected diagnosis. Queue it instead of just
      // showing an error the farmer can't do anything about in the field.
      const isNetworkFailure = err instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);
      if (isNetworkFailure) {
        await enqueueDiagnosis({ diagnosisType: type, imageBlob: uploadFile, fileName: uploadFile.name, fileType: uploadFile.type, coords });
        setQueuedMessage(t("offline.queuedMessage"));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setPhase("idle");
    }
  }

  const pickerBtn = "inline-flex min-h-touch cursor-pointer items-center justify-center rounded-control px-4 text-[0.95rem] font-medium transition-colors";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-semibold text-primary-dark sm:text-3xl">{t("diagnose.title")}</h1>
      <p className="mt-1.5 text-ink-soft">{t("diagnose.subtitle")}</p>

      <div className="mt-4">
        <OfflineQueueBanner />
      </div>

      <fieldset className="mt-6" disabled={loading}>
        <legend className="mb-2 text-sm font-semibold text-ink">{t("diagnose.step1")}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TYPES.map((value) => (
            <label key={value} className="block cursor-pointer">
              <input
                type="radio"
                name="diagnosis-type"
                value={value}
                checked={type === value}
                onChange={() => {
                  setType(value);
                  reset();
                }}
                className="peer sr-only"
              />
              <span className="block h-full rounded-card border-2 border-line bg-paper-raised px-4 py-3 transition-colors hover:border-ink-soft/50 peer-checked:border-primary peer-checked:bg-primary-50 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-disabled:opacity-60">
                <span className="block font-semibold text-ink">{t(`diagnose.type.${value}`)}</span>
                <span className="mt-0.5 block text-sm text-ink-soft">{t(`diagnose.type.${value}.desc`)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="mt-6" aria-labelledby="step2">
        <h2 id="step2" className="mb-2 font-sans text-sm font-semibold text-ink">
          {t("diagnose.step2")}
        </h2>

        {error && !loading && (
          <div className="mb-3">
            <Alert>{error}</Alert>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!loading) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`rounded-card border-2 border-dashed p-4 text-center sm:p-6 ${
            dragging ? "border-primary bg-primary-50" : "border-line bg-paper-raised"
          }`}
        >
          {preview && file ? (
            <div className="flex flex-col items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={t("diagnose.previewAlt")} className="max-h-72 w-auto max-w-full rounded-control object-contain" />
              <p className="max-w-full break-all text-sm text-ink-soft">
                {file.name} · {formatSize(file.size)}
              </p>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-ink-soft">{t("diagnose.photoTip")}</p>
            </div>
          )}

          <div className="mt-3 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
            <label className={`${pickerBtn} bg-primary text-paper-raised hover:bg-primary-dark focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 ${loading ? "pointer-events-none opacity-55" : ""}`}>
              {file ? t("diagnose.replace") : t("diagnose.takePhoto")}
              <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleInput} disabled={loading} className="sr-only" />
            </label>
            <label className={`${pickerBtn} border border-primary/40 bg-paper-raised text-primary-dark hover:bg-primary-50 focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 ${loading ? "pointer-events-none opacity-55" : ""}`}>
              {t("diagnose.chooseFile")}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleInput} disabled={loading} className="sr-only" />
            </label>
            {file && (
              <Button variant="ghost" onClick={() => acceptFile(null)} disabled={loading}>
                {t("diagnose.remove")}
              </Button>
            )}
          </div>
          {!file && <p className="mt-3 hidden text-sm text-ink-soft sm:block">{t("diagnose.dropHint")}</p>}
        </div>

        <p className="mt-2 text-sm text-ink-soft">{t("diagnose.locationNote")}</p>

        <Button size="lg" className="mt-4 w-full" onClick={handleSubmit} disabled={!file} loading={loading}>
          {phase === "preparing" ? t("diagnose.preparing") : loading ? t("diagnose.submitting") : t("diagnose.submit")}
        </Button>
        {!file && !loading && <p className="mt-2 text-center text-sm text-ink-soft">{t("diagnose.selectPhoto")}</p>}
        {loading && (
          // No real progress value is available from the API, so this is deliberately indeterminate.
          <div role="progressbar" aria-label={t("diagnose.submitting")} className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/70">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
          </div>
        )}
      </section>

      {queuedMessage && (
        <div className="mt-6">
          <Alert tone="info">{queuedMessage}</Alert>
        </div>
      )}

      {result && <ResultCard result={result} imageUrl={preview} headingRef={resultHeadingRef} />}
      {result && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="secondary"
            onClick={() => {
              acceptFile(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {t("diagnose.another")}
          </Button>
          <Link href="/history" className="inline-flex min-h-touch items-center justify-center rounded-control px-4 font-medium text-primary-dark hover:bg-primary-50">
            {t("diagnose.viewHistory")}
          </Link>
        </div>
      )}
    </div>
  );
}

function ResultCard({
  result,
  imageUrl,
  headingRef,
}: {
  result: DiagnosisResult;
  imageUrl: string | null;
  headingRef: React.RefObject<HTMLHeadingElement>;
}) {
  const { t } = useLanguage();
  const { crop, condition } = splitLabel(result.result_label);
  const healthy = /healthy$/i.test(condition);
  const pct = Math.round(Math.max(0, Math.min(1, result.confidence_score)) * 100);
  const heatmap = result.heatmap_url && /^https?:\/\//i.test(result.heatmap_url) ? result.heatmap_url : null;
  const sections: [string, string | undefined][] = [
    [t("diagnose.organic"), result.organic_treatment],
    [t("diagnose.chemical"), result.chemical_treatment],
    [t("diagnose.prevention"), result.prevention_tips],
  ];

  return (
    <Card as="section" className="mt-8" aria-labelledby="result-heading">
      {crop && <p className="text-sm font-medium text-ink-soft">{crop}</p>}
      <h2 id="result-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-semibold text-ink outline-none">
        {healthy ? `${condition}: ${t("diagnose.healthy")}` : condition}
      </h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ExpertBadge needsExpertReview={result.needs_expert_review} expertReviewed={result.expert_reviewed} />
        <SeverityTag severity={result.severity} />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-ink">{t("diagnose.confidence")}</span>
          <span className="font-semibold text-ink">{pct}%</span>
        </div>
        <div
          role="meter"
          aria-label={t("diagnose.confidence")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-line/70"
        >
          <div className={`h-full rounded-full ${result.needs_expert_review ? "bg-earth" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {result.needs_expert_review && <Alert tone="warning">{t("diagnose.lowConfidence")}</Alert>}
        {result.retry_guidance && <Alert tone="warning">{result.retry_guidance}</Alert>}
        {result.weather_advisory && (
          <Alert tone="info">
            <span className="font-semibold">{t("diagnose.weather")}: </span>
            {result.weather_advisory}
          </Alert>
        )}
      </div>

      {(imageUrl || heatmap) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={t("diagnose.previewAlt")} className="h-48 w-full rounded-control object-cover" />
          )}
          {heatmap && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heatmap} alt={t("diagnose.heatmap")} className="h-48 w-full rounded-control object-cover" />
              <figcaption className="mt-1 text-sm text-ink-soft">{t("diagnose.heatmap")}</figcaption>
            </figure>
          )}
        </div>
      )}

      {sections.map(
        ([title, body]) =>
          body && (
            <div key={title} className="mt-5 border-t border-line pt-4">
              <h3 className="text-base font-semibold text-primary-dark">{title}</h3>
              <p className="mt-1 whitespace-pre-line text-ink">{body}</p>
            </div>
          ),
      )}

      <p className="mt-5 border-t border-line pt-4 text-sm text-ink-soft">{t("diagnose.disclaimer")}</p>
    </Card>
  );
}
