// Resolves a public SoundCloud URL to a working w.soundcloud.com player iframe
// src via SoundCloud's public oEmbed endpoint (no API key required).
//
// Why oEmbed instead of building w.soundcloud.com/player/?url=<public-url>
// ourselves: the player widget resolves a raw public URL for *tracks* and
// *sets*, but NOT for *user profiles* — those need the resolved
// api.soundcloud.com/users/{id} resource URL, which only the resolve/oEmbed
// step produces. oEmbed handles all three resource types uniformly, so the
// returned src always works.

const OEMBED_ENDPOINT = "https://soundcloud.com/oembed";
const PLAYER_HOST = "w.soundcloud.com";

interface OEmbedOptions {
  /** Player accent colour as a hex string including the leading `#`. */
  color?: string;
  /** Big-artwork ("visual") player vs. the compact list player. */
  visual?: boolean;
  autoPlay?: boolean;
  showComments?: boolean;
}

export async function fetchSoundCloudEmbedSrc(
  soundcloudUrl: string,
  opts: OEmbedOptions = {},
): Promise<string | null> {
  const params = new URLSearchParams({
    format: "json",
    url: soundcloudUrl,
    // URLSearchParams encodes the leading `#` to %23 exactly once — passing a
    // pre-encoded "%23..." here would double-encode it (the original bug).
    color: opts.color ?? "#C8A050",
    visual: String(opts.visual ?? false),
    auto_play: String(opts.autoPlay ?? false),
    show_comments: String(opts.showComments ?? false),
  });

  let res: Response;
  try {
    res = await fetch(`${OEMBED_ENDPOINT}?${params.toString()}`, {
      // oEmbed resolution is stable; cache a day so a force-dynamic detail-page
      // render doesn't make a network round-trip on every request.
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  const html = (data as { html?: unknown }).html;
  if (typeof html !== "string") return null;

  const match = html.match(/src="([^"]+)"/);
  const rawSrc = match?.[1];
  if (!rawSrc) return null;

  // oEmbed html may HTML-encode ampersands; decode so the src is a valid URL.
  const src = rawSrc.replaceAll("&amp;", "&");

  // Defense in depth: the src comes from SoundCloud, but validate the host
  // before handing it to an iframe — and it must stay within our CSP frame-src.
  try {
    if (new URL(src).hostname.toLowerCase() !== PLAYER_HOST) return null;
  } catch {
    return null;
  }

  return src;
}
