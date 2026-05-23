/*
 * CSP builder for the admin app. Mirrors apps/web/lib/csp.ts but stays
 * separate so each app can evolve its directives independently (admin
 * doesn't load R2 media; web doesn't talk to internal admin APIs).
 *
 * See apps/web/lib/csp.ts for the rationale on 'strict-dynamic' +
 * 'unsafe-inline' (fallback) and the deliberate retention of style-src
 * 'unsafe-inline'.
 */
export function buildAdminCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
