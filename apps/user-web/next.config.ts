import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: resolve(__dirname, "../.."),
  distDir: process.env.TASK20_NEXT_DIST_DIR || ".next",
  experimental: {
    extensionAlias: { ".js": [".ts", ".tsx", ".js"] },
  },
  pageExtensions: ["page.tsx", "page.ts", "js"],
  typescript: {
    tsconfigPath: process.env.TASK20_NEXT_TSCONFIG || "next.tsconfig.json",
  },
};

export default nextConfig;
