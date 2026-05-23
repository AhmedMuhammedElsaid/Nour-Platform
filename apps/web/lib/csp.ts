/*
 * CSP builder for the web app. Called from middleware on every request so
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
    // scripts without re-listing every CDN; 'unsafe-inline' stays as a
    // CSP1/2 fallback that modern browsers ignore once 'strict-dynamic'
    // is present.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
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
