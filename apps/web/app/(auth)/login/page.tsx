"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useLanguage } from "@/lib/i18n";
import { EMAIL_RE, authErrorMessage } from "@/lib/authErrors";
import AuthCard from "@/components/AuthCard";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";

type Errors = { email?: string; password?: string };

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): Errors {
    const e: Errors = {};
    if (!email.trim()) e.email = t("validation.emailRequired");
    else if (!EMAIL_RE.test(email.trim())) e.email = t("validation.emailInvalid");
    if (!password) e.password = t("validation.passwordRequired");
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (loading) return;
    setError(null);
    const found = validate();
    setErrors(found);
    const first = (["email", "password"] as const).find((k) => found[k]);
    if (first) {
      (formRef.current?.elements.namedItem(first) as HTMLElement | null)?.focus();
      return;
    }
    setLoading(true);
    try {
      await api.auth.login(email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      setError(authErrorMessage(err, t));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      title={t("login.title")}
      subtitle={t("login.subtitle")}
      footer={
        <>
          {t("login.noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary-dark underline underline-offset-2 hover:text-primary">
            {t("login.signupLink")}
          </Link>
        </>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Field
          name="email"
          type="email"
          label={t("login.email")}
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          required
        />
        <Field
          name="password"
          type="password"
          label={t("login.password")}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          required
        />
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? t("login.submitting") : t("login.submit")}
        </Button>
      </form>
    </AuthCard>
  );
}
