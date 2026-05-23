import { NextResponse, type NextRequest } from "next/server";

import { buildWebCsp } from "@/lib/csp";

const r2Base = process.env.R2_PUBLIC_BASE ?? "";
let r2Hostname = "";
if (r2Base) {
  try {
    r2Hostname = new URL(r2Base).hostname;
  } catch {
    // malformed URL — skip the R2 directive
  }
}

/*
 * Edge-runtime middleware for the public web app. Generates a per-request
 * nonce and attaches it to a dynamic CSP response header so we can drop
 * 'unsafe-inline' from script-src. Adding middleware forces dynamic
 * rendering on all matched routes — accepted trade-off for the security
 * win; revisit ISR/static-cache strategy in Phase 2 if traffic grows.
 */
export function proxy(request: NextRequest): NextResponse {
  // Web Crypto is available in the Edge runtime; no Node imports needed.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildWebCsp(nonce, r2Hostname);

  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: forwardedHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  /*
   * Match every route EXCEPT static assets:
   *   /_next/static/*  — JS/CSS bundles (immutable, no inline scripts)
   *   /_next/image/*   — optimized images
   *   /favicon.ico     — browser default
   * Excluding these keeps the middleware cost off the hot static-asset path.
   */
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
