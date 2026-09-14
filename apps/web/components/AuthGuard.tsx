"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/**
 * Wrap any page's content with <AuthGuard> to keep logged-out farmers off
 * pages that need an account (diagnose, dashboard, farm, chat, history).
 * Sends them to /login instead of letting them hit a confusing API error.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-neutral-400">
        Loading…
      </div>
    );
  }

  if (isAuthenticated === false) {
    return null; // redirecting
  }

  return <>{children}</>;
}