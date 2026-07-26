import type { GetServerSideProps } from "next";

/** API keys live on Security — keep this path as a permanent redirect for old links. */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: "/settings/security#api-keys", permanent: false },
});

export default function ApiKeysRedirectPage() {
  return null;
}
