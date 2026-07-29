"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { AuthEmailStatusPage } from "@/components/ui/auth/auth-email-status-page";
import { SignInPage } from "@/components/ui/sign-in";
import { useTranslation } from "@/components/ui/locale-provider";

export function SignupPageClient({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signedUpEmail, setSignedUpEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const loginHref =
    callbackUrl !== "/dashboard"
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    setFormError(null);
    const formData = new FormData(event.currentTarget);
    const payload = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let body: { error?: string; email?: string } = {};
      const raw = await res.text();
      if (raw) {
        try {
          body = JSON.parse(raw) as { error?: string; email?: string };
        } catch {
          body = {};
        }
      }

      if (!res.ok) {
        setFormError(body.error ?? t("auth.couldNotCreateAccount", { status: res.status }));
        return;
      }

      setSignedUpEmail(body.email ?? payload.email);
    } catch {
      setFormError(t("auth.networkError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!signedUpEmail) return;
    setResendError(null);
    setResendLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: signedUpEmail }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setResendError(data.error ?? t("auth.unexpectedError"));
      }
    } catch {
      setResendError(t("auth.networkError"));
    } finally {
      setResendLoading(false);
    }
  };

  if (signedUpEmail) {
    return (
      <AuthEmailStatusPage
        variant="checkEmail"
        email={signedUpEmail}
        onResend={() => void handleResend()}
        resendLoading={resendLoading}
        resendError={resendError}
      />
    );
  }

  return (
    <main id="main-content" className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative z-10">
        <div className="px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-zinc-950/70 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 hover:text-white"
            >
              <ArrowLeft className="size-4" />
              {t("auth.goBack")}
            </Link>
            <span className="text-lg font-semibold text-white">Synaro</span>
          </div>
        </div>
        <SignInPage
          mode="signup"
          title={<span className="font-light tracking-tighter text-white">{t("auth.createAccountTitle")}</span>}
          description={t("auth.signUpDescription")}
          heroImageSrc="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=2160&q=80"
          submitLabel={t("auth.createAccount")}
          footerPrompt={t("auth.alreadyHaveAccount")}
          footerActionLabel={t("auth.signIn")}
          footerActionHref={loginHref}
          oauthCallbackUrl={callbackUrl}
          onSignIn={handleSignUp}
          onCreateAccount={() => {}}
          formError={formError}
          isSubmitting={isSubmitting}
        />
      </div>
    </main>
  );
}
