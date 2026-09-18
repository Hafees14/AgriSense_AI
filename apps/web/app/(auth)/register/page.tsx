"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useLanguage, type Language } from "@/lib/i18n";

const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල (Sinhala)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
];

type Role = "farmer" | "officer" | "researcher";

export default function RegisterPage() {
  const router = useRouter();
  const { t, setLanguage } = useLanguage();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", language: "en" as Language });
  const [role, setRole] = useState<Role>("farmer");
  const [officerCode, setOfficerCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.auth.register({
        ...form,
        role,
        // Only sent when relevant — the backend rejects officer/researcher
        // signup entirely unless a code was actually configured server-side.
        ...(role !== "farmer" ? { officer_code: officerCode } : {}),
      });
      await api.auth.login(form.email, form.password);
      // The account is now saved with this language — reflect it in the UI
      // immediately rather than waiting for the next /auth/me refresh.
      setLanguage(form.language);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="mb-6 text-2xl font-bold text-primary">{t("register.title")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder={t("register.name")}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-4 py-2"
          required
        />
        <input
          type="email"
          placeholder={t("register.email")}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-4 py-2"
          required
        />
        <input
          type="text"
          placeholder={t("register.phone")}
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-4 py-2"
        />
        <input
          type="password"
          placeholder={t("register.password")}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full rounded-lg border border-neutral-300 px-4 py-2"
          required
          minLength={8}
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-600">{t("register.language")}</label>
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value as Language })}
            className="w-full rounded-lg border border-neutral-300 px-4 py-2"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-600">Account type</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-neutral-300 px-4 py-2"
          >
            <option value="farmer">Farmer</option>
            <option value="officer">Agricultural officer</option>
            <option value="researcher">Researcher</option>
          </select>
        </div>

        {role !== "farmer" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-600">Officer/researcher signup code</label>
            <input
              type="text"
              placeholder="Provided by your program coordinator"
              value={officerCode}
              onChange={(e) => setOfficerCode(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-4 py-2"
              required
            />
            <p className="mt-1 text-xs text-neutral-500">
              This role can review other farmers&apos; diagnoses, so it requires a code from your team — not open
              self-signup.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? t("register.submitting") : t("register.submit")}
        </button>
      </form>
    </main>
  );
}