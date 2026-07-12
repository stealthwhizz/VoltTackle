import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the Turbopack workspace root to the monorepo root so builds are
  // deterministic (Vercel/CI can otherwise mis-infer it and fail).
  turbopack: { root: path.join(__dirname, "..", "..") },
  transpilePackages: ["@volt-tackle/shared"],
  reactStrictMode: true,
};

export default nextConfig;
