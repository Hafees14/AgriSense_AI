"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/useCurrentUser";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import NotificationBell from "@/components/NotificationBell";

function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#1C2B1E" />
      <path
        d="M16 26c0-7.4 2.8-11.4 7.4-13.3-2.2 5.2-2.8 9.3-2.8 13.3"
        stroke="#C97F17"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M16 6c5.3 2.2 8.7 6.8 8.7 12.1-5.3-.6-8.7-5.5-8.7-12.1z" fill="#2F6B3D" />
      <path d="M16 6c-5.3 2.2-8.7 6.8-8.7 12.1 5.3-.6 8.7-5.5 8.7-12.1z" fill="#5B9A5E" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden
    >
      {open ? <path d="M6 6l12 12M18 6l-12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

export default function Navbar() {
  const { isAuthenticated, refresh } = useAuth();
  const currentUser = useCurrentUser();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile panel automatically on navigation, so it never sits
  // open over the next page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  function handleLogout() {
    api.auth.logout();
    refresh();
    setMenuOpen(false);
    router.push("/");
  }

  const loggedInLinks = [
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/diagnose", label: t("nav.diagnose") },
    { href: "/outbreaks", label: t("nav.outbreaks") },
    { href: "/chat", label: t("nav.chat") },
    { href: "/history", label: t("nav.history") },
    ...(currentUser?.role === "officer" ? [{ href: "/review", label: t("nav.reviewQueue") }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
      {/* Six nav links plus language switcher, bell, and logout don't fit
          a phone screen — this used to just shrink padding at `sm:` and
          would wrap/overflow. Full row now only shows at `lg`; everything
          below that gets a proper slide-down panel instead. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2" onClick={() => setMenuOpen(false)}>
          <LeafMark className="h-8 w-8" />
          <span className="font-display text-lg font-semibold text-ink">AgriSense</span>
        </Link>

        {isAuthenticated === null ? null : isAuthenticated ? (
          <>
            {/* Desktop nav */}
            <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
              {loggedInLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`border-b-2 px-2.5 py-5 text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "border-primary text-primary"
                      : "border-transparent text-ink-soft hover:border-line hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="hidden items-center gap-2 lg:flex">
              <LanguageSwitcher />
              <NotificationBell />
              <button
                onClick={handleLogout}
                className="rounded border border-line px-3 py-2 text-sm font-medium text-ink-soft hover:border-chili/40 hover:text-chili"
              >
                {t("nav.logout")}
              </button>
            </div>

            {/* Mobile / tablet trigger */}
            <div className="flex items-center gap-1 lg:hidden">
              <NotificationBell />
              <button
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                className="flex h-10 w-10 items-center justify-center rounded text-ink hover:bg-primary-50"
              >
                <MenuIcon open={menuOpen} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/login" className="rounded px-3 py-2 text-sm font-medium text-ink-soft hover:text-primary">
              {t("nav.login")}
            </Link>
            <Link
              href="/register"
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-paper hover:bg-primary-dark"
            >
              {t("nav.register")}
            </Link>
          </div>
        )}
      </div>

      {isAuthenticated && menuOpen && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line bg-paper px-4 pb-4 pt-1 lg:hidden">
          <ul className="flex flex-col divide-y divide-line">
            {loggedInLinks.map((link) => (
              <li key={link.href}>
                {/* 48px+ tap targets throughout — this panel is built for
                    someone tapping with one hand, often outdoors. */}
                <Link
                  href={link.href}
                  className={`flex min-h-[48px] items-center text-base font-medium ${
                    pathname === link.href ? "text-primary" : "text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3">
            <LanguageSwitcher />
            <button
              onClick={handleLogout}
              className="rounded border border-line px-3 py-2 text-sm font-medium text-chili"
            >
              {t("nav.logout")}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}