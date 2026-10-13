"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { EMAIL_RE } from "@/lib/authErrors";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Field from "@/components/ui/Field";
import Textarea from "@/components/ui/Textarea";

// Real project contact details go here once the team supplies them —
// deliberately left as placeholders rather than invented, per the "don't
// fabricate contact info" requirement. Update these constants.
const SUPPORT_EMAIL = "ayyashfawzan15@gmail.com"; // TODO: replace with the real AgriSense AI contact email

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const EMPTY: FormState = { name: "", email: "", subject: "", message: "" };
const ORDER: (keyof FormState)[] = ["name", "email", "subject", "message"];

export default function ContactPage() {
  const { t } = useLanguage();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  function validate(): Partial<FormState> {
    const e: Partial<FormState> = {};
    if (form.name.trim().length < 2) e.name = t("contact.err.name");
    if (!form.email.trim()) e.email = t("validation.emailRequired");
    else if (!EMAIL_RE.test(form.email.trim())) e.email = t("validation.emailInvalid");
    if (form.subject.trim().length < 2) e.subject = t("contact.err.subject");
    if (form.message.trim().length < 10) e.message = t("contact.err.message");
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (status === "sending") return;
    const found = validate();
    setErrors(found);
    const first = ORDER.find((k) => found[k]);
    if (first) {
      (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }

    setStatus("sending");
    setServerError(null);
    try {
      await api.contact.send({ ...form, name: form.name.trim(), email: form.email.trim() });
      setStatus("sent");
      setForm(EMPTY);
    } catch (err) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "";
      setServerError(err instanceof TypeError ? t("error.network") : !msg || msg.includes("[object Object]") || msg.startsWith("Request failed with status") ? t("contact.failed") : msg);
    }
  }

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold text-primary-dark">{t("contact.title")}</h1>
        <p className="mx-auto mt-2 max-w-xl text-ink-soft">{t("contact.blurb")}</p>
      </div>

      <div className="grid gap-8 sm:grid-cols-[1fr,1.2fr]">
        <Card as="section" className="h-fit">
          <h2 className="text-lg font-semibold text-ink">{t("contact.direct")}</h2>
          <p className="mt-3 text-ink-soft">
            {t("contact.email")}:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-primary-dark underline underline-offset-2 hover:text-primary [overflow-wrap:anywhere]">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </Card>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5" noValidate>
          {status === "sent" && <Alert tone="success">{t("contact.sent")}</Alert>}
          {status === "error" && serverError && <Alert>{serverError}</Alert>}

          <Field name="name" label={t("contact.name")} autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} required />
          <Field name="email" type="email" inputMode="email" label={t("contact.email")} autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} required />
          <Field name="subject" label={t("contact.subject")} value={form.subject} onChange={set("subject")} error={errors.subject} required />
          <Textarea name="message" label={t("contact.message")} rows={5} value={form.message} onChange={set("message")} error={errors.message} required />

          <Button type="submit" size="lg" loading={status === "sending"} className="w-full">
            {status === "sending" ? t("contact.sending") : t("contact.send")}
          </Button>
        </form>
      </div>
    </section>
  );
}
