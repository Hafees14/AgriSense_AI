"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import Card from "@/components/ui/Card";

const STEPS = ["1", "2", "3"] as const;

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const features = [
    { title: t("home.f1.title"), desc: t("home.f1.desc") },
    { title: t("home.f2.title"), desc: t("home.f2.desc") },
    { title: t("nav.outbreaks"), desc: t("home.f3.desc") },
    { title: t("nav.chat"), desc: t("home.f4.desc") },
    { title: t("home.f5.title"), desc: t("home.f5.desc") },
    { title: t("home.f6.title"), desc: t("home.f6.desc") },
  ];

  const primaryCta = "inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-control bg-paper-raised px-8 text-base font-semibold text-primary-dark transition-colors hover:bg-primary-50 sm:w-auto";
  const secondaryCta = "inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-control border-2 border-paper-raised/80 px-8 text-base font-semibold text-paper-raised transition-colors hover:bg-paper-raised/15 sm:w-auto";

  return (
    <div>
      <section className="relative overflow-hidden bg-ink px-4 py-20 text-paper-raised sm:px-6 sm:py-28">
        <div className="absolute inset-0" aria-hidden="true">
          <Image src="/hero-plant.jpg" alt="" fill priority sizes="100vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-ink/75" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="mb-5 inline-block rounded-full border border-paper-raised/40 px-4 py-1.5 text-sm font-medium">{t("home.badge")}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-paper-raised sm:text-6xl">AgriSense AI</h1>
          <p className="mt-4 font-display text-xl text-earth-50 sm:text-2xl">{t("home.tagline")}</p>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg">{t("home.lead")}</p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            {isAuthenticated ? (
              <>
                <Link href="/diagnose" className={primaryCta}>
                  {t("home.cta.diagnose")}
                </Link>
                <Link href="/dashboard" className={secondaryCta}>
                  {t("home.cta.dashboard")}
                </Link>
              </>
            ) : (
              <>
                <Link href="/register" className={primaryCta}>
                  {t("home.cta.start")}
                </Link>
                <Link href="/login" className={secondaryCta}>
                  {t("home.cta.login")}
                </Link>
              </>
            )}
          </div>

          {isAuthenticated === false && <p className="mt-5 text-sm">{t("home.signupNote")}</p>}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="how-heading">
        <h2 id="how-heading" className="mb-8 text-center text-2xl font-semibold text-primary-dark sm:text-3xl">
          {t("home.how")}
        </h2>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((n) => (
            <li key={n}>
              <Card className="h-full">
                <p className="text-sm font-semibold text-earth-dark">{t("home.step").replace("{n}", n)}</p>
                <h3 className="mt-1 text-lg font-semibold text-ink">{t(`home.step${n}.title`)}</h3>
                <p className="mt-2 text-ink-soft">{t(`home.step${n}.desc`)}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-paper-raised" aria-labelledby="features-heading">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <h2 id="features-heading" className="mb-8 text-center text-2xl font-semibold text-primary-dark sm:text-3xl">
            {t("home.features")}
          </h2>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.title} className="border-l-4 border-primary pl-4">
                <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                <p className="mt-1 text-ink-soft">{f.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="who-heading">
        <h2 id="who-heading" className="mb-8 text-center text-2xl font-semibold text-primary-dark sm:text-3xl">
          {t("home.who")}
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card as="article">
            <h3 className="text-lg font-semibold text-ink">{t("home.who.farmers")}</h3>
            <p className="mt-2 text-ink-soft">{t("home.who.farmers.desc")}</p>
          </Card>
          <Card as="article">
            <h3 className="text-lg font-semibold text-ink">{t("register.role.officer")}</h3>
            <p className="mt-2 text-ink-soft">{t("home.who.officers.desc")}</p>
          </Card>
        </div>
      </section>
    </div>
  );
}
