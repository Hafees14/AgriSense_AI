"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useLanguage, type Language } from "@/lib/i18n";
import { EMAIL_RE, authErrorMessage } from "@/lib/authErrors";
import AuthCard from "@/components/AuthCard";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Select from "@/components/ui/Select";

// Native-script names: each language is labelled in itself so it stays readable whatever the UI language is.
const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල (Sinhala)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
];

type Role = "farmer" | "officer" | "researcher";
type FieldName = "name" | "email" | "password" | "officer_code";
type Errors = Partial<Record<FieldName, string>>;
const ORDER: FieldName[] = ["name", "email", "password", "officer_code"];

export default function RegisterPage() {
  const router = useRouter();
  const { t, setLanguage } = useLanguage();
  const formRef = useRef<HTMLFormElement>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", language: "en" as Language });
  const [role, setRole] = useState<Role>("farmer");
  const [officerCode, setOfficerCode] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): Errors {
    const e: Errors = {};
    if (form.name.trim().length < 2) e.name = t("validation.nameMin");
    if (!form.email.trim()) e.email = t("validation.emailRequired");
    else if (!EMAIL_RE.test(form.email.trim())) e.email = t("validation.emailInvalid");
    if (!form.password) e.password = t("validation.passwordRequired");
    else if (form.password.length < 8) e.password = t("validation.passwordMin");
    if (role !== "farmer" && !officerCode.trim()) e.officer_code = t("validation.codeRequired");
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (loading) return;
    setError(null);
    const found = validate();
    setErrors(found);
    const first = ORDER.find((k) => found[k]);
    if (first) {
      (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setLoading(true);
    const email = form.email.trim();
    try {
      await api.auth.register({
        ...form,
        name: form.name.trim(),
        email,
        role,
        // Only sent when relevant — the backend rejects officer/researcher
        // signup entirely unless a code was actually configured server-side.
        ...(role !== "farmer" ? { officer_code: officerCode.trim() } : {}),
      });
      await api.auth.login(email, form.password);
      // The account is now saved with this language — reflect it in the UI
      // immediately rather than waiting for the next /auth/me refresh.
      setLanguage(form.language);
      router.push("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err, t));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title={t("register.title")}
      subtitle={t("register.subtitle")}
      footer={
        <>
          {t("register.haveAccount")}{" "}
          <Link href="/login" className="font-medium text-primary-dark underline underline-offset-2 hover:text-primary">
            {t("register.loginLink")}
          </Link>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Field
          name="name"
          label={t("register.name")}
          autoComplete="name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          required
        />
        <Field
          name="email"
          type="email"
          label={t("register.email")}
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={errors.email}
          required
        />
        <Field
          name="phone"
          type="tel"
          label={`${t("register.phone")} ${t("register.optional")}`}
          autoComplete="tel"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <Field
          name="password"
          type="password"
          label={t("register.password")}
          hint={t("register.passwordHint")}
          autoComplete="new-password"
          maxLength={128}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={errors.password}
          required
        />
        <Select
          name="language"
          label={t("register.language")}
          value={form.language}
          onChange={(e) => setForm({ ...form, language: e.target.value as Language })}
        >
          {LANGUAGE_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Select
          name="role"
          label={t("register.accountType")}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role);
            setErrors((cur) => ({ ...cur, officer_code: undefined }));
          }}
        >
          <option value="farmer">{t("register.role.farmer")}</option>
          <option value="officer">{t("register.role.officer")}</option>
          <option value="researcher">{t("register.role.researcher")}</option>
        </Select>
        {role !== "farmer" && (
          <Field
            name="officer_code"
            label={t("register.code")}
            hint={t("register.codeHint")}
            placeholder={t("register.codePlaceholder")}
            autoComplete="off"
            value={officerCode}
            onChange={(e) => setOfficerCode(e.target.value)}
            error={errors.officer_code}
            required
          />
        )}
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? t("register.submitting") : t("register.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
