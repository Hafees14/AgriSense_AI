"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

const linkCls = "inline-block py-1.5 hover:text-primary-dark hover:underline";

export default function Footer() {
  const { t } = useLanguage();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-line bg-paper-raised">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-semibold text-ink">AgriSense AI</p>
            <p className="mt-2 text-sm text-ink-soft">{t("footer.about")}</p>
          </div>

          <nav aria-label={t("footer.navigate")}>
            <p className="mb-2 text-sm font-semibold text-ink">{t("footer.navigate")}</p>
            <ul className="text-sm text-ink-soft">
              <li>
                <Link href="/dashboard" className={linkCls}>
                  {t("nav.dashboard")}
                </Link>
              </li>
              <li>
                <Link href="/diagnose" className={linkCls}>
                  {t("nav.diagnose")}
                </Link>
              </li>
              <li>
                <Link href="/outbreaks" className={linkCls}>
                  {t("nav.outbreaks")}
                </Link>
              </li>
              <li>
                <Link href="/chat" className={linkCls}>
                  {t("nav.chat")}
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">{t("footer.support")}</p>
            <ul className="text-sm text-ink-soft">
              <li>
                <Link href="/contact" className={linkCls}>
                  {t("footer.contact")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-line pt-6 text-sm text-ink-soft">
          <p>
            © {year} AgriSense AI. {t("footer.rights")}
          </p>
          <p className="mt-1">
            <a href="https://www.openstreetmap.org/copyright" className="hover:text-primary-dark hover:underline" target="_blank" rel="noreferrer">
              {t("footer.mapData")}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
