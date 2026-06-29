"use client";

import Link from "next/link";
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { getProviders, signIn } from "next-auth/react";

import { getLastLoginMethod, setLastLoginMethod, type LastLoginMethod } from "@/lib/last-login-storage";
import { cn } from "@/lib/utils";

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 48 48">
    <path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"
    />
    <path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"
    />
  </svg>
);

interface SignInPageProps {
  topLeftContent?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  submitLabel?: string;
  mode?: "login" | "signup";
  footerPrompt?: string;
  footerActionLabel?: string;
  footerActionHref?: string;
  resetPasswordHref?: string;
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  /** Post-auth destination (path on this origin), e.g. `/dashboard` */
  oauthCallbackUrl?: string;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
  /** Shown inside the form below the checkbox row. */
  error?: string | null;
  /** Legacy loading flag (currently unused in the form UI). */
  loading?: boolean;
  /** Shown under the form (e.g. API or sign-in errors). */
  formError?: string | null;
  /** Disables the primary submit button while the parent handles signup/sign-in. */
  isSubmitting?: boolean;
}

const GlassInputWrapper = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-white/15 bg-white/[0.02] backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10">
    {children}
  </div>
);

const FloatingField = ({
  name,
  type,
  label,
  className = "",
}: {
  name: string;
  type: string;
  label: string;
  className?: string;
}) => (
  <GlassInputWrapper>
    <div className="auth-floating-wrapper">
      <input
        id={name}
        name={name}
        type={type}
        placeholder=" "
        className={`auth-floating-input w-full rounded-2xl bg-transparent p-4 text-sm text-white placeholder:text-transparent focus:outline-none ${className}`}
      />
      <label htmlFor={name} className="auth-floating-label text-sm font-medium text-zinc-400">
        {label}
      </label>
    </div>
  </GlassInputWrapper>
);

function LastUsedPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border border-violet-400/35 bg-violet-500/15 px-2 py-0.5",
        "text-[0.625rem] font-medium uppercase tracking-wide text-violet-200/90",
        className,
      )}
    >
      Used last time
    </span>
  );
}

export const SignInPage: React.FC<SignInPageProps> = ({
  topLeftContent,
  title = <span className="font-light tracking-tighter text-white">Welcome</span>,
  description = "Access your account and continue your journey with us",
  heroImageSrc,
  submitLabel = "Sign In",
  mode = "login",
  footerPrompt = "New to our platform?",
  footerActionLabel = "Create Account",
  footerActionHref,
  resetPasswordHref,
  error,
  onSignIn,
  oauthCallbackUrl = "/dashboard",
  onResetPassword,
  onCreateAccount,
  formError,
  isSubmitting = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [githubBusy, setGithubBusy] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [lastLoginMethod] = useState<LastLoginMethod | null>(() => getLastLoginMethod());

  const showLastUsed = mode === "login" && lastLoginMethod !== null;

  const handleGoogleClick = async () => {
    setGoogleError(null);
    setGoogleBusy(true);
    setLastLoginMethod("google");
    try {
      const providers = await getProviders();
      if (!providers?.google) {
        setGoogleError(
          "Google sign-in is not available. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then restart the dev server.",
        );
        return;
      }

      /* OAuth always triggers a full-page redirect from next-auth’s client. */
      await signIn("google", { callbackUrl: oauthCallbackUrl });
    } catch (e) {
      setGoogleError(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleGithubClick = async () => {
    setGithubError(null);
    setGithubBusy(true);
    setLastLoginMethod("github");
    try {
      const providers = await getProviders();
      if (!providers?.github) {
        setGithubError(
          "GitHub sign-in is not available. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, then restart the dev server.",
        );
        return;
      }
      await signIn("github", { callbackUrl: oauthCallbackUrl });
    } catch (e) {
      setGithubError(e instanceof Error ? e.message : "GitHub sign-in failed.");
    } finally {
      setGithubBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col font-sans md:flex-row">
      <section className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            {topLeftContent}
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
              {title}
            </h1>
            <p className="text-zinc-400">{description}</p>

            {formError ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert">
                {formError}
              </p>
            ) : null}

            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void Promise.resolve(onSignIn?.(event));
              }}
            >
              {mode === "signup" && (
                <div>
                  <FloatingField name="fullName" type="text" label="Full Name" />
                </div>
              )}

              <div>
                <FloatingField name="email" type="email" label="Email Address" />
              </div>

              <div>
                <GlassInputWrapper>
                  <div className="auth-floating-wrapper relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder=" "
                      className="auth-floating-input w-full rounded-2xl bg-transparent p-4 pr-12 text-sm text-white placeholder:text-transparent focus:outline-none"
                    />
                    <label htmlFor="password" className="auth-floating-label text-sm font-medium text-zinc-400">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="size-5 text-zinc-500 transition-colors hover:text-white" />
                      ) : (
                        <Eye className="size-5 text-zinc-500 transition-colors hover:text-white" />
                      )}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              {mode === "signup" && (
                <div>
                  <FloatingField
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    label="Confirm Password"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-3">
                  <input type="checkbox" name="rememberMe" className="custom-checkbox" />
                  <span className="text-zinc-300">Keep me signed in</span>
                </label>
                {resetPasswordHref ? (
                  <Link
                    href={resetPasswordHref}
                    className="text-violet-400 transition-colors hover:underline"
                  >
                    Reset password
                  </Link>
                ) : (
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onResetPassword?.();
                    }}
                    className="text-violet-400 transition-colors hover:underline"
                  >
                    Reset password
                  </a>
                )}
              </div>

              {error && (
                <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 font-medium text-black transition-colors hover:bg-zinc-200 disabled:pointer-events-none disabled:opacity-60"
              >
                <span>{isSubmitting ? "Please wait…" : submitLabel}</span>
                {showLastUsed && lastLoginMethod === "email" ? <LastUsedPill /> : null}
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <span className="w-full border-t border-white/10" />
              <span className="absolute bg-black px-4 text-sm text-zinc-500">
                Or continue with
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={googleBusy || githubBusy}
                onClick={() => void handleGoogleClick()}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 py-4 text-zinc-100 transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleIcon />
                <span className="flex items-center gap-2">
                  {googleBusy ? "Redirecting…" : "Continue with Google"}
                  {showLastUsed && lastLoginMethod === "google" ? <LastUsedPill /> : null}
                </span>
              </button>
              <button
                type="button"
                disabled={googleBusy || githubBusy}
                onClick={() => void handleGithubClick()}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 py-4 text-zinc-100 transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GitHubIcon />
                <span className="flex items-center gap-2">
                  {githubBusy ? "Redirecting…" : "Continue with GitHub"}
                  {showLastUsed && lastLoginMethod === "github" ? <LastUsedPill /> : null}
                </span>
              </button>
            </div>
            {googleError ? (
              <p className="text-center text-sm text-red-400/90" role="alert">
                {googleError}
              </p>
            ) : null}
            {githubError ? (
              <p className="text-center text-sm text-red-400/90" role="alert">
                {githubError}
              </p>
            ) : null}

            <p className="text-center text-sm text-zinc-500">
              {footerPrompt}{" "}
              {footerActionHref ? (
                <Link href={footerActionHref} className="text-violet-400 transition-colors hover:underline">
                  {footerActionLabel}
                </Link>
              ) : (
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onCreateAccount?.();
                  }}
                  className="text-violet-400 transition-colors hover:underline"
                >
                  {footerActionLabel}
                </a>
              )}
            </p>
          </div>
        </div>
      </section>

      {heroImageSrc && (
        <section className="relative hidden flex-1 p-4 md:block">
          <div
            className="absolute inset-4 rounded-3xl bg-cover bg-center"
            style={{ backgroundImage: `url(${heroImageSrc})` }}
          />
        </section>
      )}
    </div>
  );
};
