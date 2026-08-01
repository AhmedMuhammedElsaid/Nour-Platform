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
    // `geolocation=(self)` — NOT `()`. The prayer-times location picker calls
    // navigator.geolocation ("use my location", plus the one-shot first-visit
    // attempt behind nour.prayer.locationAsked), so a blanket deny meant the
    // app shipped a feature its own header forbade: the button silently failed
    // in production with "Geolocation access has been blocked because of a
    // permissions policy". `self` grants it to our own documents only —
    // cross-origin iframes still can't ask. Camera and mic stay fully denied.
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(self), payment=(), usb=(), serial=(), midi=(), browsing-topics=(), display-capture=(), idle-detection=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Isolate our top-level browsing context from cross-origin openers/openees
  // (Spectre-class mitigation) and force a dedicated OS process. Neither
  // affects <audio> playback or the /api/v1 JSON responses — safe everywhere.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
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
      // Cross-Origin-Resource-Policy says who may *embed/fetch* our
      // responses cross-origin. Scoped in two mutually-exclusive matches
      // (not a single "/(.*)" + override) so behavior never depends on
      // Next's header-merge ordering:
      //  - HTML documents (extensionless paths) get same-origin. That is where
      //    CORP is worth having; everything this site serves is public, so the
      //    protection on static assets is marginal.
      //  - /api/v1/* stays cross-origin: it is the public contract the mobile
      //    app and the browser extension fetch from their own origins
      //    (CLAUDE.md — apps/mobile and apps/extension talk to /api/v1/*).
      //  - /audio/* stays cross-origin: the extension sets the adhan clips as
      //    an <audio src> on ITS origin (apps/extension/src/lib/audio-router.ts
      //    builds `${SITE}/audio/adhan.mp3`), which is a no-cors subresource
      //    load and exactly what CORP blocks.
      //  - Dotted paths (images, manifest, icons, sw.js) get NO CORP header at
      //    all, so they keep the permissive default. The extension resolves
      //    origin-relative image paths against this origin via assetUrl() in
      //    apps/extension/src/lib/api.ts and renders them as <img>; a
      //    same-origin CORP would blank every station and scholar image with
      //    no error visible on the web side.
      // The three matchers below are mutually exclusive, so the result never
      // depends on Next's header-merge ordering for a repeated key.
      {
        source: "/:path((?!api/v1/|audio/)[^.]*)",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }],
      },
      {
        source: "/api/v1/:path*",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }],
      },
      {
        source: "/audio/:path*",
        headers: [{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }],
      },
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
