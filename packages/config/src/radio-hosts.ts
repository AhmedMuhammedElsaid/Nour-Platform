// Single source of truth for which hosts a radio station may stream from.
//
// This module is imported by THREE layers that must never drift:
//   - Schema:  Zod validation of `radioStation.streamUrl` / `.nowPlayingUrl`
//              (@repo/shared-core/schemas/radio) — a bad row cannot be written
//              through the app.
//   - Web CSP: `media-src` / `connect-src` in apps/web/lib/csp.ts — an off-list
//              origin is silently unplayable in the browser anyway.
//   - Web API: the server-side now-playing route re-checks immediately before
//              `fetch`, so a row that bypassed Zod (direct Atlas insert, or one
//              written before this file existed) still cannot be reached.
//
// That last layer is the SSRF boundary: `now-playing` is the only route that
// opens an outbound socket to a DB-supplied URL and reflects part of the
// response back to an unauthenticated caller. Without a re-check a row pointing
// at `http://169.254.169.254/latest/meta-data/…` turns the serverless function
// into a cloud-metadata proxy.
//
// It MUST stay a pure leaf with zero imports (no `./env`, no node APIs) so it
// is safe in the Edge runtime, the client bundle, and Metro/RN alike — same
// contract as ./embed-hosts.

/*
 * Patterns are CSP host-source expressions WITHOUT the scheme, and the matcher
 * below implements CSP semantics exactly:
 *   - `*.qurango.net` matches any strict subdomain, NOT the apex `qurango.net`.
 *   - a bare `example.com` matches only that exact host.
 * Keeping the two in lockstep means "allowed to fetch" and "allowed to play"
 * can never disagree.
 *
 *   *.qurango.net       — Quran reciter radios incl. the Haram (Al-Sudais) & mix (mp3quran)
 *   *.radioca.st        — As-Sunnah An-Nabawiyyah radio
 *   *.zeno.fm           — Cairo live Quran re-broadcast (quran-cairo-live), Nabulsi lectures,
 *                         Sha'rawi lectures, and tawasheeh stations
 *   *.surfernetwork.com — the CDN edge *.zeno.fm 302s to; a redirect target must be
 *                         allowlisted too, both for CSP and for the now-playing fetch
 *   *.mp3islam.com      — Sheikh Mohamed Rifat radio (direct HTTPS Shoutcast, no redirect)
 *
 * NOTE: radiojar (http-only edges) and mixlr (dropped 2026-07-03 when the Haram
 * station moved to an HTTPS qurango mount) are intentionally absent. Add further
 * station stream hosts here as seeded — and nowhere else.
 */
export const RADIO_HOST_PATTERNS: readonly string[] = [
  "*.qurango.net",
  "*.radioca.st",
  "*.zeno.fm",
  "*.surfernetwork.com",
  "*.mp3islam.com",
];

/**
 * CSP source expressions for the radio hosts, for `media-src` + `connect-src`.
 * Every stream is HTTPS-only by policy, so the scheme is hard-coded here and
 * mirrored by the `https:` check in `isAllowedRadioUrl`.
 */
export const RADIO_CSP_SOURCES: readonly string[] = RADIO_HOST_PATTERNS.map(
  (pattern) => `https://${pattern}`,
);

/**
 * CSP host-source matching. `*.suffix` matches a STRICT subdomain only, which
 * is what makes the look-alike cases fail:
 *   - `evil-qurango.net`      → does not end with ".qurango.net"
 *   - `qurango.net.attacker.tld` → ends with ".tld", not ".qurango.net"
 *   - `qurango.net.`          → trailing-dot FQDN, does not match (fail closed)
 * Raw IPs and `localhost` never contain a matching suffix, so they fall out for
 * free rather than needing a separate denylist (a denylist of private ranges is
 * exactly the check that DNS rebinding and novel ranges defeat).
 */
function hostMatchesPattern(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // "*.qurango.net" → ".qurango.net"
    return host.length > suffix.length && host.endsWith(suffix);
  }
  return host === pattern;
}

/**
 * True when `url` is an absolute `https:` URL on an allowlisted radio host.
 * Anything else — `http:`, `file:`, `data:`, a raw IP, `localhost`, an
 * unparseable string — is rejected. Callers fail SAFE on `false`; they must
 * never surface the rejected URL to the client.
 */
export function isAllowedRadioUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // Scheme first: an allowlisted host over plain http: is still a downgrade and
  // still reachable via DNS/BGP interception.
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return RADIO_HOST_PATTERNS.some((pattern) => hostMatchesPattern(host, pattern));
}
