import NextAuth from "next-auth";
import type { NextMiddleware } from "next/server";
import { NextResponse } from "next/server";

import { authConfigEdge } from "@repo/api/auth/edge";

import { buildAdminCsp } from "@/lib/csp";

/*
 * Edge-runtime middleware gate for the admin app.
 * Uses the Edge-safe config slice (no Mongoose / argon2) so that it
 * runs in the Next.js Edge runtime where Node.js APIs are unavailable.
 *
 * Two concerns are layered here:
 *   1. Auth gate — redirects unauthenticated users to /login (Wave 1.3).
 *   2. Per-request CSP nonce — lets us drop 'unsafe-inline' from script-src.
 *      The dynamic CSP header is attached to every authorised response,
 *      including the redirect to /login so the login page itself gets it.
 */

function withCspNonce(response: NextResponse): NextResponse {
  // Web Crypto is Edge-runtime native; no Node imports needed.
  const nonce = btoa(crypto.randomUUID());
  response.headers.set("x-middleware-csp-nonce", nonce);
  response.headers.set("Content-Security-Policy", buildAdminCsp(nonce));
  return response;
}

// TS2742: next-auth's .auth() return type resolves through internal paths
// the compiler refuses to inline; cast here to keep the public type clean.
export const proxy = NextAuth(authConfigEdge).auth((req) => {
  const path = req.nextUrl.pathname;
  const isLoggedIn = !!req.auth;
  // /login is publicly reachable — skip the auth gate so we don't redirect
  // it to itself. The CSP wrapper still applies.
  const isLoginRoute = path === "/login" || path.startsWith("/login/");

  if (!isLoggedIn && !isLoginRoute) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    // Preserve the intended destination so the login page can redirect
    // back after a successful sign-in.
    loginUrl.searchParams.set("from", path + req.nextUrl.search);
    return withCspNonce(NextResponse.redirect(loginUrl));
  }

  // Auth.js does not forward the request automatically when a callback is
  // provided — must return NextResponse.next() explicitly for pass-through.
  return withCspNonce(NextResponse.next());
}) as unknown as NextMiddleware;

export const config = {
  /*
   * Match every route EXCEPT:
   *   /api/auth/*     — Auth.js internal endpoints (callbacks, CSRF, etc.)
   *   /_next/*        — Next.js static assets & RSC payloads
   *   /favicon.ico    — browser default asset request
   *
   * /login stays inside the matcher so the auth gate can no-op for it and
   * the CSP wrapper still applies to the login page response.
   */
  matcher: ["/((?!api/auth|_next|favicon\\.ico).*)"],
};
