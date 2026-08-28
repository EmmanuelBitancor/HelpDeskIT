import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Optimize for Vercel serverless deployment — no output flag needed,
  // Vercel's build system handles this automatically.
  images: {
    remotePatterns: [],
  },
  // Next.js 16 uses Turbopack by default
  turbopack: {},
};

export default nextConfig;
