"use client";

interface Props {
  severity: string | null | undefined;
}

// Backend severity values are "low" | "moderate" | "high" | "critical"
// (see the DB enum), but treated case-insensitively here in case a model
// or the LLM translation layer returns different casing.
const STYLES: Record<string, string> = {
  low: "bg-primary-50 text-primary-dark",
  moderate: "bg-earth-50 text-earth-dark",
  high: "bg-chili-50 text-chili-dark",
  critical: "bg-chili text-paper-raised",
};

export default function SeverityTag({ severity }: Props) {
  if (!severity) return null;
  const key = severity.toLowerCase();
  const style = STYLES[key] ?? "bg-line/60 text-ink";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${style}`}>
      {severity}
    </span>
  );
}