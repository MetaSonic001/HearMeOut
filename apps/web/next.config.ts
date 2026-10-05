import { loadEnvConfig } from "@next/env"
import type { NextConfig } from "next"
import { resolve } from "node:path"

// One env file for the whole monorepo: read the repo-root .env (a no-op where it does not exist, e.g. Vercel).
loadEnvConfig(resolve(__dirname, "../.."))

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
