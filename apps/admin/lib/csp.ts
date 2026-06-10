/*
 * CSP builder for the admin app. Mirrors apps/web/lib/csp.ts but stays
 * separate so each app can evolve its directives independently (admin
 * doesn't load R2 media; web doesn't talk to internal admin APIs).
 *
 * See apps/web/lib/csp.ts for the rationale on dropping 'unsafe-inline'
 * from script-src while keeping it in style-src.
 */
export function buildAdminCsp(nonce: string, sentryOrigin?: string): string {
  // Sentry ingest origin — only added when a DSN is configured. Computed at
  // proxy runtime from process.env.NEXT_PUBLIC_SENTRY_DSN (proxy cannot import
  // the env barrel) so unconfigured envs don't widen CSP. See ADR 0007.
  const sentryPart = sentryOrigin ? ` ${sentryOrigin}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self'",
    `connect-src 'self' https://*.r2.cloudflarestorage.com${sentryPart}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
