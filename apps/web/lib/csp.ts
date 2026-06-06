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
import { EMBED_CSP_FRAME_SRC } from "@repo/config/embed-hosts";

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
    // connect-src governs the service worker's fetch() of audio for offline
    // caching, so the R2 origin must be allowed here (not just media-src).
    `connect-src 'self'${r2Origin ? ` ${r2Origin}` : ""}`,
    // PWA: allow the same-origin service worker script and web app manifest.
    "worker-src 'self'",
    "manifest-src 'self'",
    // Allow embed iframes only from the approved host list (shared with the
    // playlist embedUrl validator in @repo/config/embed-hosts, so CSP and
    // save-time validation can never drift).
    `frame-src ${EMBED_CSP_FRAME_SRC.join(" ")}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
