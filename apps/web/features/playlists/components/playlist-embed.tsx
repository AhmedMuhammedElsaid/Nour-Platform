// Server component — renders a pre-resolved third-party embed iframe.
// The embed src is resolved upstream (in the page RSC) so this component stays
// a pure synchronous render. The src is always within the CSP frame-src
// allow-list (@repo/config/embed-hosts).

import type { ResolvedEmbed } from "../lib/embed";

interface Props {
  embed: ResolvedEmbed | null;
  /** Original stored URL — used for the attribution/fallback link. */
  sourceUrl: string;
  playlistTitle: string;
}

export function PlaylistEmbed({ embed, sourceUrl, playlistTitle }: Props) {
  if (!embed) {
    // Resolution failed (private, deleted, geo-blocked, framing-blocked) —
    // give the user an escape hatch instead of a blank box.
    return (
      <div className="mt-10">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Open on source site
        </a>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <iframe
        title={playlistTitle}
        src={embed.src}
        width="100%"
        height={embed.height}
        allow="autoplay"
        loading="lazy"
        className="rounded-xl border-0 block"
      />
      <p className="mt-2 text-xs text-text-2 text-end">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          Open on source site
        </a>
      </p>
    </div>
  );
}
