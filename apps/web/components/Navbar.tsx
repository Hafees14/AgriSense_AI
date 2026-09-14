"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api-client";

export default function Navbar() {
  const { isAuthenticated, refresh } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    api.auth.logout();
    refresh();
    router.push("/");
  }

  const loggedInLinks = [
    { href: "/dashboard", label: "My farms" },
    { href: "/diagnose", label: "Diagnose" },
    { href: "/chat", label: "Ask assistant" },
    { href: "/history", label: "History" },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
          <span aria-hidden>🌱</span> AgriSense AI
        </Link>

        {/* Still resolving auth state on first paint — render nothing to avoid a flash of the wrong links */}
        {isAuthenticated === null ? null : isAuthenticated ? (
          <div className="flex items-center gap-1 sm:gap-2">
            {loggedInLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-2.5 py-2 text-sm font-medium sm:px-3 ${
                  pathname === link.href ? "bg-primary/10 text-primary" : "text-neutral-600 hover:text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="ml-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-600 hover:border-red-300 hover:text-red-600"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:text-primary">
              Log in
            </Link>
            <Link href="/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              Get started
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}