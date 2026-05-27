import { getLocale, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { SerializedPlaylist } from "@/features/playlists/types";
import type { Locale } from "@repo/api/schemas/locale";

interface PlaylistCardProps {
  playlist: SerializedPlaylist;
}

export async function PlaylistCard({ playlist }: PlaylistCardProps) {
  const [t, locale] = await Promise.all([
    getTranslations("playlist"),
    getLocale() as Promise<Locale>,
  ]);
  const display = playlist[locale];

  return (
    <Link
      href={`/playlists/${display.slug}`}
      className="rounded-xl border border-border bg-surface hover:bg-surface-2 transition-colors p-5 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold leading-tight">
          {display.title}
        </h2>
        {playlist.status === "published" && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
            {t("published")}
          </span>
        )}
      </div>
      {display.description != null && (
        <p className="text-sm text-text-2 line-clamp-2">{display.description}</p>
      )}
    </Link>
  );
}
