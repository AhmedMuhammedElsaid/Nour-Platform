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

function buildCsp(r2Host: string): string {
  const r2Origin = r2Host ? `https://${r2Host}` : "";
  return [
    "default-src 'self'",
    // 'unsafe-inline' is required for Next.js App Router inline hydration scripts.
    // Upgrade to nonce-based CSP in a post-MVP security hardening pass.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data:${r2Origin ? ` ${r2Origin}` : ""}`,
    // next/font/google serves fonts from /_next/static/media/ — no external font host needed.
    "font-src 'self'",
    `media-src 'self'${r2Origin ? ` ${r2Origin}` : ""}`,
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

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
  { key: "Content-Security-Policy", value: buildCsp(r2Hostname) },
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
