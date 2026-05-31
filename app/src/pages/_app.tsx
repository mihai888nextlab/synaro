import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { GlobalSearch } from "@/components/ui/global-search";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AiBackgroundTaskProvider } from "@/components/ui/ai-background-task";
import { NotificationsProvider } from "@/components/ui/notifications";
import { OnboardingProvider } from "@/components/ui/onboarding";

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
    <div className="min-h-dvh bg-background antialiased">
      <ThemeProvider>
        <SessionProvider basePath="/api/auth" session={pageProps.session}>
          <NotificationsProvider>
            <AiBackgroundTaskProvider>
              <OnboardingProvider>
                {content}
                <GlobalSearch />
              </OnboardingProvider>
            </AiBackgroundTaskProvider>
          </NotificationsProvider>
        </SessionProvider>
      </ThemeProvider>
    </div>
  );
}
