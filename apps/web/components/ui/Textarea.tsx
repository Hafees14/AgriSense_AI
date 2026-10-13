"use client";

import { useId } from "react";

interface Props extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  hint?: string;
  error?: string | null;
}

export default function Textarea({ label, hint, error, className = "", ...rest }: Props) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className="control resize-y" {...rest} />
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
