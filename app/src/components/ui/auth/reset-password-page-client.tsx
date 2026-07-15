"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";

import { AuthEmailStatusPage } from "@/components/ui/auth/auth-email-status-page";
import { useTranslation } from "@/components/ui/locale-provider";

export function ResetPasswordPageClient() {
  const router = useRouter();
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const raw = router.query.token;
  const token = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  if (!router.isReady) {
    return null;
  }

  if (!token) {
    return <AuthEmailStatusPage variant="verifyInvalid" />;
  }

  if (done) {
    return <AuthEmailStatusPage variant="resetSuccess" />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? t("auth.unexpectedError"));
        return;
      }
      setDone(true);
    } catch {
      setError(t("auth.networkError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-black text-white">
      <div className="px-4 pt-4 sm:px-6 sm:pt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-zinc-950/70 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {t("auth.goBack")}
        </Link>
      </div>

      <section className="mx-auto max-w-md px-4 py-12 sm:px-6 sm:py-16">
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.chooseNewPasswordTitle")}</h1>
        <p className="mt-2 text-sm text-zinc-400">{t("auth.chooseNewPasswordDescription")}</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm text-zinc-300">{t("auth.password")}</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-white/15 bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-violet-400/70"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-zinc-300">{t("auth.confirmPassword")}</span>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-2xl border border-white/15 bg-white/[0.02] px-4 py-3 text-sm text-white outline-none focus:border-violet-400/70"
            />
          </label>
          {error ? (
            <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60"
          >
            {loading ? t("auth.pleaseWait") : t("auth.updatePassword")}
          </button>
        </form>
      </section>
    </main>
  );
}
