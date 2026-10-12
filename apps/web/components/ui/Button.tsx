"use client";

import { forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-paper-raised hover:bg-primary-dark active:bg-primary-dark",
  secondary: "border border-primary/40 bg-paper-raised text-primary-dark hover:bg-primary-50",
  ghost: "text-primary-dark hover:bg-primary-50",
  danger: "bg-chili text-paper-raised hover:bg-chili-dark",
};

const SIZES: Record<Size, string> = {
  md: "min-h-touch px-4 text-[0.95rem]",
  lg: "min-h-[3.25rem] px-6 text-base",
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", loading = false, disabled, className = "", children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});

export default Button;
