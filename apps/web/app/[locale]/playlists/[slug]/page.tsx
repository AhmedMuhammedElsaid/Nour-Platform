import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPlaylistBySlug } from "@repo/api/services/playlist";
import { LOCALES } from "@repo/api/schemas/locale";
import {
  localeAlternates,
  defaultTwitter,
  absoluteUrl,
  musicPlaylistLd,
  breadcrumbLd,
  SITE_NAME,
} from "@/lib/seo";
import { JsonLd } from "@/features/seo/components/json-ld";

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
import { listCategories } from "@repo/api/services/category";
import Image from "next/image";
import type { Locale } from "@repo/api/schemas/locale";
import type { Playlist } from "@repo/api/schemas/playlist";
import type { PlayableTrack } from "@repo/api/services/track";
import { TrackListPlayer } from "@/features/playlists/components/track-list-player";
import { SetLocaleAlternates } from "@/features/layout/locale-alternates-context";
import { getCoverEmoji, getCoverGradient } from "@/features/playlists/lib/cover-art";
import { Link } from "@/i18n/navigation";
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const playlist = await getPlaylistBySlug(locale, decodeSlug(slug));

  if (!playlist || playlist.status !== "published") {
    return { title: t("notFound"), robots: { index: false } };
  }

  const tp = await getTranslations({ locale, namespace: "playlist" });
  const display = playlist[locale];

  // Build per-locale paths for canonical + hreflang (including x-default).
  const pathByLocale = Object.fromEntries(
    LOCALES.flatMap((l) => {
      const s = playlist[l].slug;
      return s ? [[l, `/${l}/playlists/${s}`]] : [];
    }),
  ) as Partial<Record<Locale, string>>;
  const { canonical, languages } = localeAlternates(locale, pathByLocale);

  const ogCoverUrl = playlist.coverMediaId
    ? await getMediaUrlById(playlist.coverMediaId)
    : null;

  const description = display.description ?? tp("listenOn");

  return {
    title: display.title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale,
      url: canonical,
      title: display.title,
      description,
      // Prefer the playlist's own cover; fall back to the default OG image
      // (resolved against metadataBase set in the root layout).
      images: ogCoverUrl ? [{ url: ogCoverUrl }] : [{ url: "/og-image.png" }],
    },
    twitter: defaultTwitter(),
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

  const allCategories = playlist.categoryIds.length > 0 ? await listCategories() : [];
  const playlistCategories = playlist.categoryIds
    .map((id) => allCategories.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => c != null)
    .map((c) => ({ slug: c[locale].slug, name: c[locale].name }));

  const publishedDate = new Date(serializedPlaylist.createdAt).toLocaleDateString(
    locale === "ar" ? "ar" : "en-US",
    { year: "numeric", month: "long", day: "numeric" },
  );

  const [gradFrom, gradTo] = getCoverGradient(playlist.id);
  const emoji = getCoverEmoji(playlist.id);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-text-2 hover:text-primary mb-6"
      >
        <span aria-hidden="true">{locale === "ar" ? "→" : "←"}</span>
        {t("backToHome")}
      </Link>

      {/* Register both locale slugs so the header's language switcher routes to
          the correct slug instead of reusing this locale's (which would 404). */}
      <SetLocaleAlternates
        alternates={{
          ar: `/playlists/${playlist.ar.slug}`,
          en: `/playlists/${playlist.en.slug}`,
        }}
      />

      {/* Structured data — nonce is read inside JsonLd (CSP-mandatory). */}
      <JsonLd
        data={musicPlaylistLd({
          title: display.title,
          description: display.description ?? undefined,
          url: absoluteUrl(`/${locale}/playlists/${display.slug}`),
          image: coverUrl ?? undefined,
          numTracks: displayTracks.length,
          locale,
        })}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: SITE_NAME, url: absoluteUrl(`/${locale}`) },
          { name: display.title, url: absoluteUrl(`/${locale}/playlists/${display.slug}`) },
        ])}
      />

      {/* Cover hero */}
      <div className="relative w-full h-48 md:h-72 overflow-hidden rounded-xl mb-8">
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
          />
        ) : (
          <div
            className="size-full flex items-center justify-center"
            style={{ background: `linear-gradient(to bottom, ${gradFrom}, ${gradTo})` }}
          >
            <span className="text-7xl select-none" aria-hidden="true">{emoji}</span>
          </div>
        )}
        {/* Gradient fade into page background */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg/80 pointer-events-none" />
      </div>

      <header>
        <h1 className="font-display text-4xl tracking-tight">{display.title}</h1>
        {display.description != null && (
          <p className="mt-2 text-text-2">{display.description}</p>
        )}
        {playlistCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {playlistCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/?category=${cat.slug}`}
                className="border border-border text-text-2 text-xs rounded-full px-2 py-0.5 hover:border-primary/50 hover:text-primary transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
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
