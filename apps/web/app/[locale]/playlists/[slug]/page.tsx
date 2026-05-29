import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPlaylistBySlug } from "@repo/api/services/playlist";
import { LOCALES } from "@repo/api/schemas/locale";

// Next.js + next-intl do not percent-decode the dynamic [slug] param, so a
// non-ASCII (Arabic) slug arrives URL-encoded (e.g. "%D8%AF…") and never
// matches the stored Unicode slug. Decode at the request boundary before the
// service lookup. Wrapped in try/catch because a malformed percent sequence
// throws URIError; slugs never legitimately contain a bare "%", so falling
// back to the raw value just yields a clean notFound().
function decodeSlug(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

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
import { SetLocaleAlternates } from "@/features/layout/locale-alternates-context";
import type {
  SerializedPlaylist,
  DisplayTrack,
} from "@/features/playlists/types";

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

function serializePlaylist(p: Playlist): SerializedPlaylist {
  return {
    ...p,
    createdAt: typeof p.createdAt === "string" ? p.createdAt : p.createdAt.toISOString(),
    updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : p.updatedAt.toISOString(),
  };
}

function toDisplayTrack(t: PlayableTrack, locale: Locale): DisplayTrack {
  return {
    id: t.id,
    title: t[locale].title,
    slug: t[locale].slug,
    description: t[locale].description,
    mediaId: t.mediaId,
    playlistId: t.playlistId,
    order: t.order,
    ...(t.durationSecs != null ? { durationSecs: t.durationSecs } : {}),
    srcUrl: t.srcUrl,
    createdAt: typeof t.createdAt === "string" ? t.createdAt : t.createdAt.toISOString(),
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : t.updatedAt.toISOString(),
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
  const playlist = await getPlaylistBySlug(locale, decodeSlug(slug));

  if (!playlist || playlist.status !== "published") {
    return { title: t("notFound") };
  }

  // hreflang alternates: both locale slugs are on the single document.
  const languages: Record<string, string> = {};
  for (const l of LOCALES) {
    const altSlug = playlist[l].slug;
    if (altSlug) {
      languages[l] = `${baseUrl}/${l}/playlists/${altSlug}`;
    }
  }

  const tp = await getTranslations({ locale, namespace: "playlist" });
  const display = playlist[locale];
  const canonical = `${baseUrl}/${locale}/playlists/${display.slug}`;
  return {
    title: `${display.title} — Nour`,
    description: display.description ?? tp("listenOn"),
    alternates: { canonical, languages },
    openGraph: {
      type: "website",
      locale,
      url: canonical,
      title: display.title,
      ...(display.description ? { description: display.description } : {}),
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

  const playlist = await getPlaylistBySlug(locale, decodeSlug(slug));
  if (!playlist || playlist.status !== "published") notFound();

  const tracks = await getTracksWithUrls(playlist.id);
  const coverUrl = playlist.coverMediaId
    ? await getMediaUrlById(playlist.coverMediaId)
    : null;

  const display = playlist[locale];
  const serializedPlaylist = serializePlaylist(playlist);
  const displayTracks = tracks.map((t) => toDisplayTrack(t, locale));

  const publishedDate = new Date(serializedPlaylist.createdAt).toLocaleDateString(
    locale === "ar" ? "ar" : "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Register both locale slugs so the header's language switcher routes to
          the correct slug instead of reusing this locale's (which would 404). */}
      <SetLocaleAlternates
        alternates={{
          ar: `/playlists/${playlist.ar.slug}`,
          en: `/playlists/${playlist.en.slug}`,
        }}
      />
      <header>
        <h1 className="font-display text-4xl tracking-tight">{display.title}</h1>
        {display.description != null && (
          <p className="mt-2 text-text-2">{display.description}</p>
        )}
        <p className="mt-1 text-sm text-text-2">
          {t("trackCount", { count: displayTracks.length })} &middot; {publishedDate}
        </p>
      </header>

      <section aria-labelledby="tracks-heading">
        <h2 id="tracks-heading" className="text-lg font-semibold mt-10 mb-4">
          {t("tracksHeading")}
        </h2>
        <TrackListPlayer
          tracks={displayTracks}
          playlistTitle={display.title}
          coverUrl={coverUrl ?? undefined}
          playlistSlug={display.slug}
          locale={locale}
        />
      </section>
    </div>
  );
}
