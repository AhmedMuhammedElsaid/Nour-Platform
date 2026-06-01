// Server component — static iframe, no JS, no Widget API script.
// The frame origin is always w.soundcloud.com (built here); the stored
// soundcloudUrl is only ever used as a query param.

interface Props {
  soundcloudUrl: string;
  playlistTitle: string;
}

export function SoundCloudEmbed({ soundcloudUrl, playlistTitle }: Props) {
  const src =
    "https://w.soundcloud.com/player/?" +
    new URLSearchParams({
      url: soundcloudUrl,
      color: "%23C8A050", // --color-primary gold (pre-encoded for URLSearchParams)
      auto_play: "false",
      hide_related: "true",
      show_comments: "false",
      visual: "false",
    }).toString();

  return (
    <div className="mt-10">
      <iframe
        title={playlistTitle}
        src={src}
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
