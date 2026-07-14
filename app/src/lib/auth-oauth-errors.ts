export function oauthErrorMessage(code: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    OAuthSignin: t("profile.oauthSignin"),
    OAuthCallback: t("profile.oauthCallback"),
    OAuthCreateAccount: t("profile.oauthCreateAccount"),
    EmailCreateAccount: t("profile.emailCreateAccount"),
    Callback: t("profile.callback"),
    OAuthAccountNotLinked: t("profile.oauthAccountNotLinked"),
    SessionRequired: t("profile.sessionRequired"),
    AccessDenied: t("profile.accessDenied"),
    CredentialsSignin: t("auth.invalidCredentials"),
    EMAIL_NOT_VERIFIED: t("auth.emailNotVerified"),
    Default: t("profile.oauthSignInFailed"),
  };
  return map[code] ?? map.Default;
}
