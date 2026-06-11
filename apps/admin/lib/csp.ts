/*
 * CSP builder for the admin app. Mirrors apps/web/lib/csp.ts but stays
 * separate so each app can evolve its directives independently (admin
 * doesn't load R2 media; web doesn't talk to internal admin APIs).
 *
 * See apps/web/lib/csp.ts for the rationale on dropping 'unsafe-inline'
 * from script-src while keeping it in style-src.
 */
export function buildAdminCsp(nonce: string): string {
  return [
    "default-src 'self'",
    // Dev ONLY: React dev builds + Turbopack HMR need eval(); see
    // apps/web/lib/csp.ts. NEVER add 'unsafe-eval' to production.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""
    }`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self'",
    "connect-src 'self' https://*.r2.cloudflarestorage.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
