import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  getPlaylistBySlug,
  getPlaylistSlugForLocale,
} from "@repo/api/services/playlist";
import { LOCALES } from "@repo/api/schemas/locale";

// Opt out of static prerendering. proxy.ts sets a per-request CSP nonce,
// which would mismatch a cached static HTML body; forcing dynamic rendering
// is also what the deploy build (no Atlas connection at build time) requires.
export const dynamic = "force-dynamic";
import { getTracksWithUrls } from "@repo/api/services/track";
import { getMediaUrlById } from "@repo/api/services/media";
import type { Locale } from "@repo/api/schemas/locale";
import type { Playlist } from "@repo/api/schemas/playlist";
import type { PlayableTrack } from "@repo/api/services/track";
import { TrackListPlayer } from "@/features/playlists/components/track-list-player";
import type {
  SerializedPlaylist,
  SerializedPlayableTrack,
} from "@/features/playlists/types";

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializePlaylist(p: Playlist): SerializedPlaylist {
  return {
    ...p,
    createdAt:
      typeof p.createdAt === "string" ? p.createdAt : p.createdAt.toISOString(),
    updatedAt:
      typeof p.updatedAt === "string" ? p.updatedAt : p.updatedAt.toISOString(),
  };
}

function serializePlayableTrack(t: PlayableTrack): SerializedPlayableTrack {
  return {
    ...t,
    createdAt:
      typeof t.createdAt === "string" ? t.createdAt : t.createdAt.toISOString(),
    updatedAt:
      typeof t.updatedAt === "string" ? t.updatedAt : t.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

// Public site origin for absolute SEO URLs. Read directly (not via the env
// barrel) because this runs during build's page-data collection where the
// barrel's required secrets aren't present — same documented exception as the
// health route / next.config (NEXT_PUBLIC_* is build-inlined, not a secret).
const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const playlist = await getPlaylistBySlug(locale, slug);

  if (!playlist || playlist.status !== "published") {
    return { title: t("notFound") };
  }

  // hreflang alternates: resolve each locale's own (published) slug via the
  // shared contentId — slugs differ per locale, so we can't swap the prefix.
  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    const altSlug =
      l === locale
        ? playlist.slug
        : await getPlaylistSlugForLocale(playlist.contentId, l);
    if (altSlug) {
      languages[l] = `${baseUrl}/${l}/playlists/${altSlug}`;
    }
  }

  const tp = await getTranslations({ locale, namespace: "playlist" });
  const canonical = `${baseUrl}/${locale}/playlists/${playlist.slug}`;
  return {
    title: `${playlist.title} — Nour`,
    description: playlist.description ?? tp("listenOn"),
    alternates: { canonical, languages },
    openGraph: {
      type: "website",
      locale,
      url: canonical,
      title: playlist.title,
      ...(playlist.description ? { description: playlist.description } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PlaylistDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("playlist");

  const playlist = await getPlaylistBySlug(locale, slug);

  if (!playlist || playlist.status !== "published") {
    notFound();
  }

  const tracks = await getTracksWithUrls(locale, playlist.contentId);
  const coverUrl = playlist.coverMediaId
    ? await getMediaUrlById(playlist.coverMediaId)
    : null;

  const serializedPlaylist = serializePlaylist(playlist);
  const serializedTracks = tracks.map(serializePlayableTrack);

  const publishedDate = new Date(
    serializedPlaylist.createdAt,
  ).toLocaleDateString(locale === "ar" ? "ar" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const trackCount = serializedTracks.length;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header>
        <h1 className="font-display text-4xl tracking-tight">
          {serializedPlaylist.title}
        </h1>
        {serializedPlaylist.description != null && (
          <p className="mt-2 text-text-2">{serializedPlaylist.description}</p>
        )}
        <p className="mt-1 text-sm text-text-2">
          {t("trackCount", { count: trackCount })} &middot; {publishedDate}
        </p>
      </header>

      <section aria-labelledby="tracks-heading">
        <h2 id="tracks-heading" className="text-lg font-semibold mt-10 mb-4">
          {t("tracksHeading")}
        </h2>
        <TrackListPlayer
          tracks={serializedTracks}
          playlistTitle={serializedPlaylist.title}
          coverUrl={coverUrl ?? undefined}
        />
      </section>
    </div>
  );
}
