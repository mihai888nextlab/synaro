"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

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

export interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

interface SignInPageProps {
  topLeftContent?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  testimonials?: Testimonial[];
  submitLabel?: string;
  mode?: "login" | "signup";
  footerPrompt?: string;
  footerActionLabel?: string;
  footerActionHref?: string;
  resetPasswordHref?: string;
  onSignIn?: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn?: () => void;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
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

const TestimonialCard = ({ testimonial }: { testimonial: Testimonial }) => (
  <div className="flex w-64 items-start gap-3 rounded-3xl border border-white/10 bg-zinc-900/60 p-5 backdrop-blur-xl">
    <Image
      src={testimonial.avatarSrc}
      width={40}
      height={40}
      className="size-10 rounded-2xl object-cover"
      alt="avatar"
    />
    <div className="text-sm leading-snug">
      <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
      <p className="text-zinc-400">{testimonial.handle}</p>
      <p className="mt-1 text-zinc-300">{testimonial.text}</p>
    </div>
  </div>
);

export const SignInPage: React.FC<SignInPageProps> = ({
  topLeftContent,
  title = <span className="font-light tracking-tighter text-white">Welcome</span>,
  description = "Access your account and continue your journey with us",
  heroImageSrc,
  testimonials = [],
  submitLabel = "Sign In",
  mode = "login",
  footerPrompt = "New to our platform?",
  footerActionLabel = "Create Account",
  footerActionHref,
  resetPasswordHref,
  onSignIn,
  onGoogleSignIn,
  onResetPassword,
  onCreateAccount,
}) => {
  const [showPassword, setShowPassword] = useState(false);

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

            <form className="space-y-5" onSubmit={onSignIn}>
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

              <button
                type="submit"
                className="w-full rounded-2xl bg-white py-4 font-medium text-black transition-colors hover:bg-zinc-200"
              >
                {submitLabel}
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <span className="w-full border-t border-white/10" />
              <span className="absolute bg-black px-4 text-sm text-zinc-500">
                Or continue with
              </span>
            </div>

            <button
              onClick={onGoogleSignIn}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/15 py-4 text-zinc-100 transition-colors hover:bg-zinc-900"
            >
              <GoogleIcon />
              Continue with Google
            </button>

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
          {testimonials.length > 0 && (
            <div className="absolute bottom-8 left-1/2 flex w-full -translate-x-1/2 justify-center gap-4 px-8">
              <TestimonialCard testimonial={testimonials[0]} />
              {testimonials[1] && (
                <div className="hidden xl:flex">
                  <TestimonialCard testimonial={testimonials[1]} />
                </div>
              )}
              {testimonials[2] && (
                <div className="hidden 2xl:flex">
                  <TestimonialCard testimonial={testimonials[2]} />
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
