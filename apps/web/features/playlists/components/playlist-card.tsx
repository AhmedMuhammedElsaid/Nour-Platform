import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { getMediaUrlById } from "@repo/api/services/media";
import { Link } from "@/i18n/navigation";
import type { SerializedPlaylist } from "@/features/playlists/types";
import type { Locale } from "@repo/api/schemas/locale";
import { getCoverGradient, getCoverEmoji } from "@/features/playlists/lib/cover-art";

interface CategoryChip {
  slug: string;
  name: string;
}

interface PlaylistCardProps {
  playlist: SerializedPlaylist;
  categories?: CategoryChip[];
}

export async function PlaylistCard({ playlist, categories }: PlaylistCardProps) {
  const locale = (await getLocale()) as Locale;
  const display = playlist[locale];
  const t = await getTranslations("playlist");

  const coverUrl = playlist.coverMediaId
    ? await getMediaUrlById(playlist.coverMediaId)
    : null;

  const [gradFrom, gradTo] = getCoverGradient(playlist.id);
  const emoji = getCoverEmoji(playlist.id);

  return (
    <Link
      href={`/playlists/${display.slug}`}
      className="group relative rounded-2xl border border-border bg-surface hover:-translate-y-1 hover:z-10 hover:border-primary/30 transition-all duration-200 flex flex-col items-center text-center gap-2 p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Circle cover art */}
      <div className="relative w-[78%] aspect-square rounded-full overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 20vw, 40vw"
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
      </div>



      <h2 className="font-display text-base font-semibold leading-snug w-full">
        {display.title}
      </h2>

      {display.description != null && (
        <p className="text-sm text-text-2 line-clamp-2 w-full">{display.description}</p>
      )}

      {/* Track count badge — outside the circle so overflow-hidden doesn't clip it */}
      {playlist.trackCount != null && playlist.trackCount > 0 && (
        <span className="rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold px-2.5 py-0.5">
          {playlist.trackCount} { t("track")}
        </span>
      )}
      {categories != null && categories.length > 0 && (
        <div data-testid="category-chips" className="flex flex-wrap gap-1.5 justify-center w-full">
          {categories.slice(0, 2).map((cat) => (
            <span
              key={cat.slug}
              className="border border-border text-text-2 text-xs rounded-full px-2 py-0.5"
            >
              {cat.name}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
