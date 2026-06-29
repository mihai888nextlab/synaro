"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { signIn } from "next-auth/react";

import { SignInPage } from "@/components/ui/sign-in";
import { setLastLoginMethod } from "@/lib/last-login-storage";
import { setOnboardingPending } from "@/lib/onboarding-storage";

export function SignupPageClient() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

      let body: { error?: string } = {};
      const raw = await res.text();
      if (raw) {
        try {
          body = JSON.parse(raw) as { error?: string };
        } catch {
          body = {};
        }
      }

      if (!res.ok) {
        setFormError(body.error ?? `Could not create account (${res.status}). Try again.`);
        return;
      }

      setOnboardingPending();

      const callbackUrl =
        typeof window !== "undefined" ? `${window.location.origin}/dashboard` : "/dashboard";

      const auth = await signIn("credentials", {
        email: payload.email,
        password: payload.password,
        callbackUrl,
        redirect: false,
      });

      if (auth?.error) {
        setFormError(
          auth.error === "CredentialsSignin"
            ? "Account was created but sign-in failed. Try logging in from the login page."
            : `Sign-in failed: ${auth.error}`,
        );
        return;
      }

      setLastLoginMethod("email");

      if (auth?.url) {
        await router.push(auth.url);
        return;
      }

      await router.push("/dashboard");
    } catch {
      setFormError("Network error — check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="relative z-10">
        <div className="px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-zinc-950/70 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900 hover:text-white"
            >
              <ArrowLeft className="size-4" />
              Go back
            </Link>
            <span className="text-lg font-semibold text-white">Synaro</span>
          </div>
        </div>
        <SignInPage
          mode="signup"
          title={<span className="font-light tracking-tighter text-white">Create Account</span>}
          description="Create your Synaro workspace and start managing your cloud infrastructure."
          heroImageSrc="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=2160&q=80"
          submitLabel="Create account"
          footerPrompt="Already have an account?"
          footerActionLabel="Sign in"
          footerActionHref="/login"
          onSignIn={handleSignUp}
          onResetPassword={() => {}}
          onCreateAccount={() => {}}
          formError={formError}
          isSubmitting={isSubmitting}
        />
      </div>
    </main>
  );
}
