/*
 * CSP builder for the web app. Called from proxy.ts on every request so
 * each response carries a unique nonce — that's what allows us to drop
 * `'unsafe-inline'` from script-src. Next.js's framework runtime scripts
 * pick up the nonce automatically from the response header.
 *
 * style-src keeps `'unsafe-inline'` intentionally: React 19 and Next.js
 * still emit inline <style> nodes for CSS-in-JS / font-loader payloads,
 * and inline style injection is not a meaningful XSS vector for this app
 * (no user-generated HTML rendered server-side in the MVP).
 */
export function buildWebCsp(nonce: string, r2Hostname: string): string {
  const r2Origin = r2Hostname ? `https://${r2Hostname}` : "";
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets the nonce-trusted root script load further
    // scripts without re-listing every CDN. We intentionally do NOT keep
    // 'unsafe-inline' as a fallback: CSP2-only clients would honor it and
    // silently disable nonce enforcement. Next 16 nonce propagation is
    // reliable enough that this trade-off favors stricter security.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data:${r2Origin ? ` ${r2Origin}` : ""}`,
    "font-src 'self'",
    `media-src 'self'${r2Origin ? ` ${r2Origin}` : ""}`,
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
