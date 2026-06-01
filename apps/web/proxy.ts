import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";

import { buildWebCsp } from "@/lib/csp";
import { routing } from "@/i18n/routing";

const r2Base = process.env.R2_PUBLIC_BASE ?? "";
let r2Hostname = "";
if (r2Base) {
  try {
    r2Hostname = new URL(r2Base).hostname;
  } catch {
    // malformed URL — skip the R2 directive
  }
}

const handleI18nRouting = createMiddleware(routing);

/*
 * Edge-runtime proxy for the public web app. Two responsibilities, composed:
 *
 *  1. Locale routing (next-intl): redirects `/` to the Accept-Language match
 *     (defaulting to Arabic) and rewrites `/ar|/en/...` to the [locale] tree.
 *  2. CSP nonce: a per-request nonce attached to a dynamic CSP header so we can
 *     drop 'unsafe-inline' from script-src (see lib/csp.ts).
 *
 * Order matters: we mutate the incoming request headers with `x-nonce` BEFORE
 * next-intl builds its rewrite response, so the nonce is forwarded to the app;
 * then we set the CSP header on whatever response next-intl returns (including
 * the root redirect). Replacing this proxy with the bare next-intl middleware
 * would silently drop the nonce and break CSP on every page.
 */
export function proxy(request: NextRequest): NextResponse {
  // Web Crypto is available in the Edge runtime; no Node imports needed.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildWebCsp(nonce, r2Hostname);

  // Forwarded to the rendered request so server components can read the nonce.
  // next-intl rewrites reuse the request headers, so this propagates.
  request.headers.set("x-nonce", nonce);

  const response = handleI18nRouting(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match every route EXCEPT API routes and static assets. We exclude:
     *   /api/*                — JSON endpoints
     *   /_next/static|image/* — bundled assets / image optimizer
     *   any path with a dot   — every file under /public (scholar photos like
     *                           /muhmd-bakr.png, plus sw.js, manifest.webmanifest,
     *                           favicon.ico, og-image.png, icons/*.svg, …).
     *                           Without this, next-intl locale-redirects e.g.
     *                           /muhmd-bakr.png → /ar/muhmd-bakr.png → 404 and the
     *                           <img> never loads.
     * App routes never contain a dot (slugs are letters/numbers/hyphens), so the
     * dot rule is safe and self-maintaining as new public files are added.
     */
    "/((?!api|_next/static|_next/image|.*\\..*).*)",
  ],
};
