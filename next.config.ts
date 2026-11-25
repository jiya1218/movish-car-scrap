import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    "/api/**/*": ["./prisma/clean-template.db"],
  },
};

export default nextConfig;
