"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";

// Real project contact details go here once the team supplies them —
// deliberately left as placeholders rather than invented, per the "don't
// fabricate contact info" requirement. Update these constants.
const SUPPORT_EMAIL = "ayyashfawzan15@gmail.com"; // TODO: replace with the real AgriSense AI contact email
const PROJECT_NAME = "AgriSense AI";
const PROJECT_BLURB =
  "AgriSense AI helps smallholder farmers diagnose crop diseases and pests, track outbreaks nearby, and get farm-specific guidance — in English, Sinhala, and Tamil.";

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const EMPTY: FormState = { name: "", email: "", subject: "", message: "" };

function validate(form: FormState): Partial<FormState> {
  const errors: Partial<FormState> = {};
  if (form.name.trim().length < 2) errors.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Please enter a valid email address.";
  if (form.subject.trim().length < 2) errors.subject = "Please enter a subject.";
  if (form.message.trim().length < 10) errors.message = "Please write a few more words so we understand your message.";
  return errors;
}

export default function ContactPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validate(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setStatus("sending");
    setServerError(null);
    try {
      await api.contact.send(form);
      setStatus("sent");
      setForm(EMPTY);
    } catch (err) {
      setStatus("error");
      setServerError(err instanceof Error ? err.message : "Couldn't send your message. Please try again.");
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">Contact {PROJECT_NAME}</h1>
        <p className="mx-auto mt-2 max-w-xl text-ink-soft">{PROJECT_BLURB}</p>
      </div>

      <div className="grid gap-8 sm:grid-cols-[1fr,1.2fr]">
        <div className="space-y-4 rounded-lg border border-line bg-paper-raised p-5">
          <h2 className="font-display text-lg font-semibold text-ink">Reach us directly</h2>
          <p className="text-sm text-ink-soft">
            Email:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="text-xs text-ink-soft">
            
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {status === "sent" && (
            <p role="status" className="rounded-lg bg-primary-50 p-3 text-sm text-primary-dark">
              Thanks — your message has been sent. We&apos;ll get back to you soon.
            </p>
          )}
          {status === "error" && serverError && (
            <p role="alert" className="rounded-lg bg-chili-50 p-3 text-sm text-chili-dark">
              {serverError}
            </p>
          )}

          <div>
            <label htmlFor="contact-name" className="mb-1 block text-sm font-medium text-ink-soft">
              Name
            </label>
            <input
              id="contact-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-line bg-paper-raised px-4 py-2.5"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "contact-name-error" : undefined}
            />
            {errors.name && (
              <p id="contact-name-error" className="mt-1 text-sm text-chili">
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-ink-soft">
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-lg border border-line bg-paper-raised px-4 py-2.5"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "contact-email-error" : undefined}
            />
            {errors.email && (
              <p id="contact-email-error" className="mt-1 text-sm text-chili">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="contact-subject" className="mb-1 block text-sm font-medium text-ink-soft">
              Subject
            </label>
            <input
              id="contact-subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full rounded-lg border border-line bg-paper-raised px-4 py-2.5"
              aria-invalid={!!errors.subject}
              aria-describedby={errors.subject ? "contact-subject-error" : undefined}
            />
            {errors.subject && (
              <p id="contact-subject-error" className="mt-1 text-sm text-chili">
                {errors.subject}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="contact-message" className="mb-1 block text-sm font-medium text-ink-soft">
              Message
            </label>
            <textarea
              id="contact-message"
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full resize-none rounded-lg border border-line bg-paper-raised px-4 py-2.5"
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? "contact-message-error" : undefined}
            />
            {errors.message && (
              <p id="contact-message-error" className="mt-1 text-sm text-chili">
                {errors.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-lg bg-primary py-3 font-semibold text-paper disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Send message"}
          </button>
        </form>
      </div>
    </main>
  );
}