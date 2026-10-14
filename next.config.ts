import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongodb"],
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
