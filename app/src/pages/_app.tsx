import "@/styles/globals.css";
import type { AppContext, AppProps } from "next/app";
import App from "next/app";
import { useRouter } from "next/router";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { GlobalSearch } from "@/components/ui/global-search";
import { LocaleProvider } from "@/components/ui/locale-provider";
import { SkipLink } from "@/components/ui/skip-link";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AiBackgroundTaskProvider } from "@/components/ui/ai-background-task";
import { NotificationsProvider } from "@/components/ui/notifications";
import { OnboardingProvider } from "@/components/ui/onboarding";
import { type Locale } from "@/i18n/config";
import { resolveInitialLocale } from "@/i18n/locale-cookie";

type AppPropsWithSession = AppProps<{ session?: Session; initialLocale?: Locale }>;

function SynaroApp({ Component, pageProps }: AppPropsWithSession) {
  const router = useRouter();
  const isDashboardRoute =
    router.pathname === "/dashboard" ||
    router.pathname === "/projects" ||
    router.pathname.startsWith("/projects/") ||
    router.pathname === "/agents" ||
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
          <LocaleProvider initialLocale={pageProps.initialLocale}>
            <SkipLink />
            <NotificationsProvider>
              <AiBackgroundTaskProvider>
                <OnboardingProvider>
                  {content}
                  <GlobalSearch />
                </OnboardingProvider>
              </AiBackgroundTaskProvider>
            </NotificationsProvider>
          </LocaleProvider>
        </SessionProvider>
      </ThemeProvider>
    </div>
  );
}

SynaroApp.getInitialProps = async (appContext: AppContext) => {
  const appProps = await App.getInitialProps(appContext);
  const initialLocale = resolveInitialLocale(appContext.ctx.req?.headers.cookie);

  return {
    ...appProps,
    pageProps: {
      ...appProps.pageProps,
      initialLocale,
    },
  };
};

export default SynaroApp;
