import "@/styles/globals.css";
import type { AppContext, AppProps } from "next/app";
import App from "next/app";
import { useRouter } from "next/router";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

import { DashboardLayout } from "@/components/ui/dashboard-layout";
import { GlobalSearch } from "@/components/ui/global-search";
import { LocaleProvider } from "@/components/ui/locale-provider";
import { SynaroPageHead } from "@/components/seo/synaro-page-head";
import { SkipLink } from "@/components/ui/skip-link";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AiBackgroundTaskProvider } from "@/components/ui/ai-background-task";
import { AgentBackgroundRunsProvider } from "@/components/ui/agent-background-runs";
import { NotificationsProvider } from "@/components/ui/notifications";
import { SpeechOutputProvider } from "@/lib/speech/speech-output-provider";
import { OnboardingProvider } from "@/components/ui/onboarding";
import { TermsConsentBanner } from "@/components/ui/terms-consent-banner";
import { type Locale } from "@/i18n/config";
import { resolveInitialLocale } from "@/i18n/locale-cookie";
import { routeHeadProps } from "@/lib/seo/route-head";
import { mergePageSeo, type PageSeoProps } from "@/lib/seo/page-seo";

type AppPageProps = {
  session?: Session;
  initialLocale?: Locale;
  seo?: Partial<PageSeoProps>;
};

type AppPropsWithSession = AppProps<AppPageProps>;

function SynaroApp({ Component, pageProps }: AppPropsWithSession) {
  const router = useRouter();
  const isDashboardRoute =
    router.pathname === "/dashboard" ||
    router.pathname === "/projects" ||
    router.pathname.startsWith("/projects/") ||
    router.pathname === "/agents" ||
    router.pathname.startsWith("/agents/") ||
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

  const headProps = mergePageSeo(
    routeHeadProps(router.pathname, router.query, router.asPath),
    pageProps.seo,
  );

  return (
    <div className="min-h-dvh bg-background antialiased">
      <SynaroPageHead {...headProps} />
      <ThemeProvider>
        <SessionProvider basePath="/api/auth" session={pageProps.session}>
          <LocaleProvider initialLocale={pageProps.initialLocale}>
            <SpeechOutputProvider>
              <SkipLink />
              <NotificationsProvider>
                <AiBackgroundTaskProvider>
                  <AgentBackgroundRunsProvider>
                    <OnboardingProvider>
                      {content}
                      <GlobalSearch />
                      <TermsConsentBanner />
                    </OnboardingProvider>
                  </AgentBackgroundRunsProvider>
                </AiBackgroundTaskProvider>
              </NotificationsProvider>
            </SpeechOutputProvider>
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
