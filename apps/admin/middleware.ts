import NextAuth from "next-auth";
import type { NextMiddleware } from "next/server";
import { NextResponse } from "next/server";

import { authConfigEdge } from "@repo/api/auth/edge";

/*
 * Edge-runtime middleware gate for the admin app.
 * Uses the Edge-safe config slice (no Mongoose / argon2) so that it
 * runs in the Next.js Edge runtime where Node.js APIs are unavailable.
 *
 * Protected: everything EXCEPT /login and /api/auth/* which are
 * explicitly excluded via the matcher pattern below.
 */

// TS2742: next-auth's .auth() return type resolves through internal paths
// the compiler refuses to inline; cast here to keep the public type clean.
export default NextAuth(authConfigEdge).auth((req) => {
  const isLoggedIn = !!req.auth;

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    // Preserve the intended destination so the login page can redirect
    // back after a successful sign-in.
    loginUrl.searchParams.set("from", req.nextUrl.pathname + req.nextUrl.search);
    return Response.redirect(loginUrl);
  }

  // Auth.js does not forward the request automatically when a callback is
  // provided — must return NextResponse.next() explicitly for pass-through.
  return NextResponse.next();
}) as unknown as NextMiddleware;

export const config = {
  /*
   * Match every route EXCEPT:
   *   /login          — the sign-in page itself
   *   /api/auth/*     — Auth.js internal endpoints (callbacks, CSRF, etc.)
   *   /_next/*        — Next.js static assets & RSC payloads
   *   /favicon.ico    — browser default asset request
   */
  matcher: ["/((?!login|api/auth|_next|favicon\\.ico).*)"],
};
