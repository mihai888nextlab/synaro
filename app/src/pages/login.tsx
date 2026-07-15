import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import type { GetServerSideProps } from "next";

import { SignInPage } from "@/components/ui/sign-in";
import { useTranslation } from "@/components/ui/locale-provider";
import { oauthErrorMessage } from "@/lib/auth-oauth-errors";
import { setLastLoginMethod } from "@/lib/last-login-storage";
import { redirectIfAuthed } from "@/lib/auth-redirect";
import { loginPageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  useEffect(() => {
    const rawError = router.query.error;
    const code =
      typeof rawError === "string" ? rawError : Array.isArray(rawError) ? rawError[0] : null;
    if (code) {
      setError(oauthErrorMessage(code, t));
      setSuccess(null);
      void router.replace("/login", undefined, { shallow: true });
      return;
    }

    const rawVerified = router.query.verified;
    const verified =
      typeof rawVerified === "string" ? rawVerified : Array.isArray(rawVerified) ? rawVerified[0] : null;
    if (verified === "1") {
      setSuccess(t("auth.emailVerifiedBody"));
      setError(null);
      void router.replace("/login", undefined, { shallow: true });
    }
  }, [router, t]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(oauthErrorMessage(result.error, t));
      } else if (result?.ok) {
        setLastLoginMethod("email");
        router.push("/dashboard");
      }
    } catch {
      setError(t("auth.unexpectedError"));
    } finally {
      setLoading(false);
    }
  };

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
          title={<span className="font-light tracking-tighter text-white">{t("auth.welcomeBack")}</span>}
          description={t("auth.signInDescription")}
          heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
          submitLabel={t("auth.signIn")}
          footerPrompt={t("auth.newToSynaro")}
          footerActionLabel={t("auth.createAccount")}
          footerActionHref="/signup"
          resetPasswordHref="/forgot-password"
          error={error}
          success={success}
          isSubmitting={loading}
          onSignIn={handleSignIn}
          onCreateAccount={() => {}}
        />
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps<{ seo: PageSeoProps }> = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard", { seo: loginPageSeo() });
