import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { ThemeProvider } from "@/components/ui/theme-provider";

type AppPropsWithSession = AppProps<{ session?: Session }>;

export default function App({ Component, pageProps }: AppPropsWithSession) {
  const router = useRouter();
  const isDashboardRoute =
    router.pathname === "/dashboard" ||
    router.pathname === "/projects" ||
    router.pathname.startsWith("/projects/") ||
    router.pathname === "/logs" ||
    router.pathname === "/settings" ||
    router.pathname.startsWith("/settings/");

  const content = isDashboardRoute ? (
    <DashboardLayout>
      <Component {...pageProps} />
    </DashboardLayout>
  ) : (
    <Component {...pageProps} />
  );

  return (
    <ThemeProvider>
      <SessionProvider session={pageProps.session}>{content}</SessionProvider>
    </ThemeProvider>
  );
}
