"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";

/**
 * Wrap any page's content with <AuthGuard> to keep logged-out farmers off
 * pages that need an account (diagnose, dashboard, farm, chat, history).
 * Sends them to /login instead of letting them hit a confusing API error.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated === null) {
    return (
      <div role="status" className="flex min-h-[50vh] items-center justify-center gap-3 text-ink-soft">
        <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        {t("common.loading")}
      </div>
    );
  }

  if (isAuthenticated === false) {
    return null; // redirecting
  }

  return <>{children}</>;
}
