"use client";

import { useId } from "react";

interface Props extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  hint?: string;
  error?: string | null;
}

export default function Select({ label, hint, error, className = "", children, ...rest }: Props) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      <select id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className="control" {...rest}>
        {children}
      </select>
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
