"use client";

import { useLanguage } from "@/lib/i18n";

interface Props {
  needsExpertReview: boolean;
  expertReviewed: boolean;
}

// Shown on a diagnosis result and in history. Only ever green when an
// officer has actually reviewed it via the /reviews queue — this badge is
// never set by the farmer's own submission, which is what makes it a real
// trust signal instead of decoration.
export default function ExpertBadge({ needsExpertReview, expertReviewed }: Props) {
  const { t } = useLanguage();

  if (expertReviewed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-dark">
        <span aria-hidden="true">✓</span> {t("badge.verified")}
      </span>
    );
  }

  if (needsExpertReview) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-earth-50 px-3 py-1 text-xs font-semibold text-earth-dark">
        <span aria-hidden="true">○</span> {t("badge.pendingReview")}
      </span>
    );
  }

  return null;
}