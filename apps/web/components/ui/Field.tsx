"use client";

import { useId, useState } from "react";
import { useLanguage } from "@/lib/i18n";

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hint?: string;
  error?: string | null;
}

/** Labelled input with hint/error wiring and, for type="password", a visibility toggle. */
export default function Field({ label, hint, error, type = "text", required, className = "", ...rest }: Props) {
  const { t } = useLanguage();
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === "password";
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="sr-only"> ({t("common.required")})</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && shown ? "text" : type}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`control ${isPassword ? "pr-12" : ""}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? t("common.hidePassword") : t("common.showPassword")}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 flex min-w-touch items-center justify-center rounded-r-control text-ink-soft hover:text-ink"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              {shown ? (
                <path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 8.5 4.5 9.5 6a15 15 0 01-3.2 3.7M6.6 6.7C4.4 8.1 2.9 10.2 2.5 12c1 1.5 4.5 6 9.5 6 1.4 0 2.7-.3 3.8-.8" />
              ) : (
                <>
                  <path d="M2.5 12C3.5 10.5 7 6 12 6s8.5 4.5 9.5 6c-1 1.5-4.5 6-9.5 6s-8.5-4.5-9.5-6z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-sm font-medium text-chili-dark">
          {error}
        </p>
      )}
    </div>
  );
}
