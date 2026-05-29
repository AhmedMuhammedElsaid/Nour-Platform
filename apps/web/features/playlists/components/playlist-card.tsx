import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { getMediaUrlById } from "@repo/api/services/media";
import { Link } from "@/i18n/navigation";
import type { SerializedPlaylist } from "@/features/playlists/types";
import type { Locale } from "@repo/api/schemas/locale";
import { getCoverGradient, getCoverEmoji } from "@/features/playlists/lib/cover-art";

interface PlaylistCardProps {
  playlist: SerializedPlaylist;
}

export async function PlaylistCard({ playlist }: PlaylistCardProps) {
  const [t, locale] = await Promise.all([
    getTranslations("playlist"),
    getLocale() as Promise<Locale>,
  ]);
  const display = playlist[locale];

  const coverUrl = playlist.coverMediaId
    ? await getMediaUrlById(playlist.coverMediaId)
    : null;

  const [gradFrom, gradTo] = getCoverGradient(playlist.id);
  const emoji = getCoverEmoji(playlist.id);

  return (
    <Link
      href={`/playlists/${display.slug}`}
      className="group rounded-xl border border-border bg-surface overflow-hidden hover:-translate-y-1 hover:border-primary/30 transition-all duration-200 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Cover art */}
      <div className="relative aspect-square w-full overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div
            className="size-full flex items-center justify-center"
            style={{
              background: `linear-gradient(to bottom, ${gradFrom}, ${gradTo})`,
            }}
          >
            <span className="text-5xl select-none" aria-hidden="true">
              {emoji}
            </span>
          </div>
        )}
        {/* Gradient fade into card body */}
        <div className="absolute inset-0 bg-linear-to-b from-transparent to-black/50 pointer-events-none" />
        {/* Track count badge */}
        {playlist.trackCount != null && playlist.trackCount > 0 && (
          <span className="absolute bottom-2 inset-e-2 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold px-2.5 py-0.5">
            {playlist.trackCount}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-base font-semibold leading-tight">
            {display.title}
          </h2>
          {playlist.status === "published" && (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
              {t("published")}
            </span>
          )}
        </div>
        {display.description != null && (
          <p className="text-sm text-text-2 line-clamp-2">{display.description}</p>
        )}
      </div>
    </Link>
  );
}
