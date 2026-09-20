import type { NextConfig } from "next";
import { resolveDbConnection } from "./src/db/config";

if (process.env.VERCEL) {
  resolveDbConnection(process.env);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
