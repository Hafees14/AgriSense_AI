"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div>
      {/* Hero Section with Image as Background & Letters inside */}
      <section className="relative overflow-hidden bg-neutral-950 px-6 py-24 text-white sm:py-32 lg:py-36">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/hero-plant.jpg"
            alt="AgriSense AI smart crop scanning background"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center brightness-75 contrast-105"
          />
          {/* Dark gradient overlay so text ('letters') stands out sharply */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/50 to-black/80" />
        </div>

        {/* Content / Letters inside the background */}
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            AI Precision Agriculture
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-6xl">
            AgriSense AI
          </h1>

          <p className="mt-4 text-xl font-medium text-emerald-300 sm:text-2xl drop-shadow">
            Your Intelligent Farming Assistant
          </p>

          <p className="mx-auto mt-6 max-w-2xl text-base text-neutral-200 sm:text-lg drop-shadow">
            Take a photo of a leaf, fruit, stem, or pest and get an instant diagnosis with a
            treatment plan — no extra hardware, no waiting, no guesswork.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {isAuthenticated ? (
              <>
                <Link
                  href="/diagnose"
                  className="w-full rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white shadow-lg transition duration-200 hover:bg-primary-light sm:w-auto"
                >
                  📷 Diagnose a plant now
                </Link>
                <Link
                  href="/dashboard"
                  className="w-full rounded-xl border-2 border-white/80 bg-white/10 px-8 py-4 text-lg font-semibold text-white backdrop-blur-md transition duration-200 hover:bg-white/20 sm:w-auto"
                >
                  Go to my farms
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="w-full rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white shadow-lg transition duration-200 hover:bg-primary-light sm:w-auto"
                >
                  Get started — it&apos;s free
                </Link>
                <Link
                  href="/login"
                  className="w-full rounded-xl border-2 border-white/80 bg-white/10 px-8 py-4 text-lg font-semibold text-white backdrop-blur-md transition duration-200 hover:bg-white/20 sm:w-auto"
                >
                  I already have an account
                </Link>
              </>
            )}
          </div>

          {!isAuthenticated && (
            <p className="mt-5 text-sm text-neutral-300 drop-shadow">
              Create a free account to save your farm and get diagnoses tailored to it.
            </p>
          )}
        </div>
      </section>

      {/* Step Cards Section */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StepCard emoji="📷" step="1" title="Photograph" description="Take a photo of a leaf, fruit, stem, or pest with your phone." />
          <StepCard emoji="🔎" step="2" title="Diagnose" description="AgriSense identifies the issue with a confidence score and severity level." />
          <StepCard emoji="🌿" step="3" title="Treat" description="Get organic and chemical treatment options, tailored to your farm and today's weather." />
        </div>
      </section>
    </div>
  );
}


function StepCard({ emoji, step, title, description }: { emoji: string; step: string; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-3xl" aria-hidden>
          {emoji}
        </span>
        <span className="text-sm font-bold text-earth">STEP {step}</span>
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-neutral-600">{description}</p>
    </div>
  );
}