// Server component — renders a pre-resolved SoundCloud player iframe.
// The embed src is resolved upstream (in the page RSC) via the oEmbed endpoint,
// so this component stays a pure synchronous render. The src always targets
// w.soundcloud.com (covered by CSP frame-src).

interface Props {
  /** Resolved w.soundcloud.com player src, or null if resolution failed. */
  embedSrc: string | null;
  /** Original public SoundCloud URL — used for the attribution/fallback link. */
  soundcloudUrl: string;
  playlistTitle: string;
}

export function SoundCloudEmbed({ embedSrc, soundcloudUrl, playlistTitle }: Props) {
  if (!embedSrc) {
    // Resolution failed (private, deleted, geo-blocked, or oEmbed down) — give
    // the user a working link instead of a blank player box.
    return (
      <div className="mt-10">
        <a
          href={soundcloudUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Open on SoundCloud
        </a>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <iframe
        title={playlistTitle}
        src={embedSrc}
        width="100%"
        height={450}
        allow="autoplay"
        loading="lazy"
        className="rounded-xl border-0 block"
      />
      <p className="mt-2 text-xs text-text-2 text-end">
        <a
          href={soundcloudUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary transition-colors"
        >
          Streaming via SoundCloud
        </a>
      </p>
    </div>
  );
}
