import type { Language } from "@/lib/i18n";

// Model labels look like "Tomato___Late_blight" (crop___condition). Display-only tidy-up; the label itself is never changed.
export function splitLabel(label: string): { crop: string | null; condition: string } {
  const tidy = (s: string) => s.replace(/_+/g, " ").trim();
  const parts = label.split("___");
  return parts.length === 2 ? { crop: tidy(parts[0]), condition: tidy(parts[1]) } : { crop: null, condition: tidy(label) };
}

const LOCALES: Record<Language, string> = { en: "en-GB", si: "si-LK", ta: "ta-LK" };

export function formatDate(iso: string, language: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(LOCALES[language], { day: "numeric", month: "short", year: "numeric" });
}

export function percent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function formatDateTime(iso: string, language: Language): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(LOCALES[language], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
