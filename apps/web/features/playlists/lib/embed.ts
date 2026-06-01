import { findEmbedProvider } from "@repo/config/embed-hosts";

import { fetchSoundCloudEmbedSrc } from "./soundcloud-oembed";

export type ResolvedEmbed = {
  src: string;
  height: number;
};

/**
 * Given an allow-listed embedUrl, returns a `{ src, height }` ready to drop
 * into an iframe, or null when the URL is off-list or resolution fails.
 *
 * SoundCloud: oEmbed-resolved to a w.soundcloud.com player src (compact list,
 * 450px). Direct-iframe providers (e.g. amgadsamir.com): src = the stored URL
 * itself, rendered at 720px (the whole page including the site's own player).
 */
export async function resolveEmbed(url: string): Promise<ResolvedEmbed | null> {
  const provider = findEmbedProvider(url);
  if (!provider) return null;

  if (provider.mode === "soundcloud-oembed") {
    const src = await fetchSoundCloudEmbedSrc(url);
    if (!src) return null;
    return { src, height: 450 };
  }

  // direct-iframe: pass the URL straight through
  return { src: url, height: 720 };
}
