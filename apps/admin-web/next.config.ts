import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  assetPrefix: "/admin-static",
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: resolve(__dirname, "../.."),
  devIndicators: false,
  distDir: process.env.TASK20_NEXT_DIST_DIR || ".next",
  pageExtensions: ["page.tsx", "page.ts", "js"],
  typescript: {
    tsconfigPath:
      process.env.TASK20_ADMIN_NEXT_TSCONFIG || process.env.TASK20_NEXT_TSCONFIG || "next.tsconfig.json",
  },
};

export default nextConfig;
