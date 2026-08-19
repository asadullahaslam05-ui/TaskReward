import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Surface all type errors at build time. A clean build must mean the types
    // are actually correct. (Phase 2U — re-enabled after all type errors fixed.)
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;