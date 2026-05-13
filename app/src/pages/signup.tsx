import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { signIn } from "next-auth/react";
import type { GetServerSideProps } from "next";

import { PageBackgroundPattern } from "@/components/ui/page-background-pattern";
import { SignInPage, type Testimonial } from "@/components/ui/sign-in";
import { redirectIfAuthed } from "@/lib/auth-redirect";

const sampleTestimonials: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Olivia Reed",
    handle: "@oliviaops",
    text: "Synaro helped our team ship safer infrastructure changes faster.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/72.jpg",
    name: "Kevin Brooks",
    handle: "@kevininfra",
    text: "The governance controls and workflows fit our enterprise setup perfectly.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/31.jpg",
    name: "Maya Patel",
    handle: "@mayaplatform",
    text: "Excellent onboarding and a consistent product experience across pages.",
  },
];

export default function SignupPage() {
  const handleSignUp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
    };

    void (async () => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return;
      }

      const callbackUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/dashboard`
          : "/dashboard";
      await signIn("credentials", {
        email: payload.email,
        password: payload.password,
        callbackUrl,
      });
    })();
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <PageBackgroundPattern />
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
          testimonials={sampleTestimonials}
          submitLabel="Create account"
          footerPrompt="Already have an account?"
          footerActionLabel="Sign in"
          footerActionHref="/login"
          onSignIn={handleSignUp}
          onResetPassword={() => {}}
          onCreateAccount={() => {}}
        />
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard");
