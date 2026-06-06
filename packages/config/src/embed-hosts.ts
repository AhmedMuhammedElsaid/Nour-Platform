// Single source of truth for which third-party hosts a playlist may embed.
//
// This module is imported by THREE layers that must never drift:
//   - API: Zod validation of `playlist.embedUrl` (reject off-list domains)
//   - Web Edge proxy: CSP `frame-src` (which iframe origins are permitted)
//   - Admin client form: the same save-time validation
//
// It MUST stay a pure leaf with zero imports (no `./env`, no node APIs) so it
// is safe in the Edge runtime and the client bundle alike.

export type EmbedMode = "soundcloud-oembed" | "direct-iframe";

export type EmbedProvider = {
  id: string;
  /** Host matches when host === suffix OR host.endsWith("." + suffix). */
  hostSuffix: string;
  mode: EmbedMode;
  /** Exact CSP source expressions for the iframe origin(s) this provider loads. */
  cspFrameSrc: string[];
};

export const EMBED_PROVIDERS: readonly EmbedProvider[] = [
  {
    id: "soundcloud",
    hostSuffix: "soundcloud.com",
    mode: "soundcloud-oembed",
    // The pasted URL is soundcloud.com/..., but the resolved player iframe
    // always loads from w.soundcloud.com.
    cspFrameSrc: ["https://w.soundcloud.com"],
  },
  {
    id: "amgadsamir",
    hostSuffix: "amgadsamir.com",
    mode: "direct-iframe",
    cspFrameSrc: ["https://amgadsamir.com", "https://*.amgadsamir.com"],
  },
];

function hostMatches(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

/** Returns the provider whose host-suffix matches the URL, or null if none / unparseable. */
export function findEmbedProvider(url: string): EmbedProvider | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  return (
    EMBED_PROVIDERS.find((p) => hostMatches(host, p.hostSuffix)) ?? null
  );
}

/** Deduplicated CSP `frame-src` source expressions across all providers. */
export const EMBED_CSP_FRAME_SRC: readonly string[] = [
  ...new Set(EMBED_PROVIDERS.flatMap((p) => p.cspFrameSrc)),
];
