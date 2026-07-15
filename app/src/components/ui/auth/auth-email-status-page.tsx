"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { useTranslation } from "@/components/ui/locale-provider";

type AuthEmailStatusPageProps = {
  variant: "checkEmail" | "verified" | "verifyInvalid" | "resetSuccess";
  email?: string;
  onResend?: () => void;
  resendLoading?: boolean;
  resendError?: string | null;
};

export function AuthEmailStatusPage({
  variant,
  email,
  onResend,
  resendLoading,
  resendError,
}: AuthEmailStatusPageProps) {
  const { t } = useTranslation();

  const copy = {
    checkEmail: {
      title: t("auth.checkEmailTitle"),
      body: t("auth.checkEmailBody", { email: email ?? "" }),
    },
    verified: {
      title: t("auth.emailVerifiedTitle"),
      body: t("auth.emailVerifiedBody"),
    },
    verifyInvalid: {
      title: t("auth.verifyInvalidTitle"),
      body: t("auth.verifyInvalidBody"),
    },
    resetSuccess: {
      title: t("auth.resetSuccessTitle"),
      body: t("auth.resetSuccessBody"),
    },
  }[variant];

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

      <section className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{copy.body}</p>

        {variant === "checkEmail" && onResend ? (
          <div className="mt-8 space-y-3">
            <button
              type="button"
              disabled={resendLoading}
              onClick={onResend}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
            >
              {resendLoading ? t("auth.pleaseWait") : t("auth.resendVerification")}
            </button>
            {resendError ? (
              <p className="text-sm text-red-400" role="alert">
                {resendError}
              </p>
            ) : null}
          </div>
        ) : null}

        <Link
          href={variant === "verified" ? "/login?verified=1" : "/login"}
          className="mt-8 inline-block text-sm text-violet-400 transition hover:text-violet-300"
        >
          {t("auth.backToSignIn")} →
        </Link>
      </section>
    </main>
  );
}
