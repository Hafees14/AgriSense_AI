"use client";

interface Props {
  severity: string | null | undefined;
}

// Backend severity values are "low" | "moderate" | "high" | "critical"
// (see the DB enum), but treated case-insensitively here in case a model
// or the LLM translation layer returns different casing.
const STYLES: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  moderate: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export default function SeverityTag({ severity }: Props) {
  if (!severity) return null;
  const key = severity.toLowerCase();
  const style = STYLES[key] ?? "bg-neutral-100 text-neutral-700";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${style}`}>
      {severity}
    </span>
  );
}