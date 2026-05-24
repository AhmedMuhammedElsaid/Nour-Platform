import type { NextConfig } from "next";

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
  ...(r2Hostname && {
    images: {
      remotePatterns: [{ protocol: "https", hostname: r2Hostname }],
    },
  }),
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
