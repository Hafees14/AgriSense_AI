"use client";

import { useLanguage } from "@/lib/i18n";
import { formatDate, percent, splitLabel } from "@/lib/format";
import Card from "@/components/ui/Card";
import ExpertBadge from "@/components/ExpertBadge";
import SeverityTag from "@/components/SeverityTag";

export interface HistoryItem {
  id: string;
  diagnosis_type: string;
  result_label: string;
  confidence_score: number;
  severity: string | null;
  image_url: string;
  progress_group_id: string | null;
  needs_expert_review: boolean;
  expert_reviewed: boolean;
  created_at: string;
}

const TYPE_KEYS = ["disease", "pest", "plant_id"];

export default function DiagnosisRow({ item }: { item: HistoryItem }) {
  const { t, language } = useLanguage();
  const { crop, condition } = splitLabel(item.result_label);
  const typeLabel = TYPE_KEYS.includes(item.diagnosis_type) ? t(`diagnose.type.${item.diagnosis_type}`) : item.diagnosis_type;

  return (
    <Card padded={false} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.image_url} alt="" className="h-16 w-16 shrink-0 rounded-control bg-line/50 object-cover sm:h-20 sm:w-20" />
      <div className="min-w-0 flex-1">
        {crop && <p className="truncate text-sm text-ink-soft">{crop}</p>}
        <p className="font-semibold text-ink [overflow-wrap:anywhere]">{condition}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <ExpertBadge needsExpertReview={item.needs_expert_review} expertReviewed={item.expert_reviewed} />
          <SeverityTag severity={item.severity} />
        </div>
        <p className="mt-1 text-sm text-ink-soft">
          {typeLabel} · {formatDate(item.created_at, language)} · {t("history.confidenceShort")} {percent(item.confidence_score)}%
        </p>
      </div>
    </Card>
  );
}
