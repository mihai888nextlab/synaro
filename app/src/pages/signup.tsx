import type { GetServerSideProps } from "next";

import { SignupPageClient } from "@/components/ui/signup-page-client";
import { redirectIfAuthed } from "@/lib/auth-redirect";

export default function SignupPage() {
  return <SignupPageClient />;
}

export const getServerSideProps: GetServerSideProps = async (ctx) =>
  redirectIfAuthed(ctx, "/dashboard");
