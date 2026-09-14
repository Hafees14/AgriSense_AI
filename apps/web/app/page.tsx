"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="text-center">
        <div className="mb-4 text-5xl" aria-hidden>
          🌾
        </div>
        <h1 className="text-4xl font-bold text-primary sm:text-5xl">AgriSense AI</h1>
        <p className="mt-3 text-xl text-neutral-600">Your Intelligent Farming Assistant</p>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-700">
          Take a photo of a leaf, fruit, stem, or pest and get an instant diagnosis with a
          treatment plan — no extra hardware, no waiting, no guesswork.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {isAuthenticated ? (
            <>
              <Link
                href="/diagnose"
                className="w-full rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white shadow-sm hover:bg-primary-dark sm:w-auto"
              >
                📷 Diagnose a plant now
              </Link>
              <Link
                href="/dashboard"
                className="w-full rounded-xl border-2 border-primary px-8 py-4 text-lg font-semibold text-primary sm:w-auto"
              >
                Go to my farms
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="w-full rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-white shadow-sm hover:bg-primary-dark sm:w-auto"
              >
                Get started — it&apos;s free
              </Link>
              <Link
                href="/login"
                className="w-full rounded-xl border-2 border-primary px-8 py-4 text-lg font-semibold text-primary sm:w-auto"
              >
                I already have an account
              </Link>
            </>
          )}
        </div>
        {!isAuthenticated && (
          <p className="mt-4 text-sm text-neutral-500">
            Create a free account to save your farm and get diagnoses tailored to it.
          </p>
        )}
      </section>

      <section className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-3">
        <StepCard emoji="📷" step="1" title="Photograph" description="Take a photo of a leaf, fruit, stem, or pest with your phone." />
        <StepCard emoji="🔎" step="2" title="Diagnose" description="AgriSense identifies the issue with a confidence score and severity level." />
        <StepCard emoji="🌿" step="3" title="Treat" description="Get organic and chemical treatment options, tailored to your farm and today's weather." />
      </section>
    </main>
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