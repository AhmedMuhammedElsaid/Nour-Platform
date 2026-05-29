import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Read R2_PUBLIC_BASE directly here — importing @repo/config/env would validate
// all env vars (including MONGODB_URI) at build time, which fails in environments
// that only expose the vars each app actually needs.
const r2Base = process.env.R2_PUBLIC_BASE ?? "";
let r2Hostname = "";
if (r2Base) {
  try {
    r2Hostname = new URL(r2Base).hostname;
  } catch {
    // malformed URL — skip remote pattern
  }
}

/*
 * Static security headers applied to every response. The Content-Security-Policy
 * header is NOT set here — it's emitted by `proxy.ts` with a per-request
 * nonce so we can drop `'unsafe-inline'` from script-src (see `lib/csp.ts`).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep these heavy/native/CJS deps (pulled in transitively via @repo/api
  // services) out of the bundler graph — they're require()'d at runtime
  // instead. Cuts per-route dev compile cost (and prod build time); mongoose
  // in particular does not bundle cleanly.
  serverExternalPackages: [
    "mongoose",
    "mongodb",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "@node-rs/argon2",
    "@auth/mongodb-adapter",
  ],
  ...(r2Hostname && {
    images: {
      remotePatterns: [{ protocol: "https", hostname: r2Hostname }],
    },
  }),
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // The service worker must not be long-cached (so updates ship) and needs
      // a root scope to control all navigations.
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
