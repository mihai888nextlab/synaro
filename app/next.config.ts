import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "ui.aceternity.com",
      },
      {
        protocol: "https",
        hostname: "randomuser.me",
      },
    ],
  },
};

/* next-auth/react inlines NEXTAUTH_URL on the client; expose it without setting an empty string (would break parsing). */
if (process.env.NEXTAUTH_URL) {
  nextConfig.env = { NEXTAUTH_URL: process.env.NEXTAUTH_URL };
}

export default nextConfig;
