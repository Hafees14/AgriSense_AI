"use client";

import { useLanguage, type Language } from "@/lib/i18n";

const OPTIONS: { code: Language; label: string; font: "" | "font-si" | "font-ta" }[] = [
  { code: "en", label: "EN", font: "" },
  { code: "si", label: "සිං", font: "font-si" },
  { code: "ta", label: "தமிழ்", font: "font-ta" },
];

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center gap-0.5 rounded-full border border-line bg-paper-raised p-0.5 text-xs"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.code}
          type="button"
          lang={opt.code}
          onClick={() => setLanguage(opt.code)}
          className={`rounded-full px-2.5 py-1.5 font-medium transition-colors ${opt.font} ${
            language === opt.code ? "bg-primary text-paper" : "text-ink-soft hover:bg-primary-50 hover:text-primary"
          }`}
          aria-pressed={language === opt.code}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}