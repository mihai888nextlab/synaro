import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import type { GetServerSideProps } from "next";

import { SignInPage, type Testimonial } from "@/components/ui/sign-in";
import { redirectIfAuthed } from "@/lib/auth-redirect";

const sampleTestimonials: Testimonial[] = [
  {
    avatarSrc: "https://randomuser.me/api/portraits/women/57.jpg",
    name: "Sarah Chen",
    handle: "@sarahdigital",
    text: "Amazing platform! The user experience is seamless and the features are exactly what I needed.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/64.jpg",
    name: "Marcus Johnson",
    handle: "@marcustech",
    text: "Clean design, powerful features, and excellent support for our platform team.",
  },
  {
    avatarSrc: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "David Martinez",
    handle: "@davidcreates",
    text: "Reliable workflows and great performance for daily deployments.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
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
        setError("Invalid email or password");
      } else if (result?.ok) {
        router.push("/dashboard");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
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
          title={<span className="font-light tracking-tighter text-white">Welcome Back</span>}
          description="Sign in to your Synaro workspace and continue managing your cloud infrastructure."
          heroImageSrc="https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80"
          testimonials={sampleTestimonials}
          submitLabel="Sign in"
          footerPrompt="New to Synaro?"
          footerActionLabel="Create account"
          footerActionHref="/signup"
          error={error}
          loading={loading}
          onSignIn={handleSignIn}
          onResetPassword={() => { }}
          onCreateAccount={() => { }}
        />
      </div>
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard");
