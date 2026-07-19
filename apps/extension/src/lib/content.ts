import type { Playlist } from "@repo/shared-core/schemas/playlist";
import type { Track } from "@repo/shared-core/schemas/track";

import { assetUrl, getJson } from "./api";
import type { QueueItem } from "./player-state";
import { get, set, type RecentItem } from "./storage";

const LOCALE = "ar" as const;

type PlayableTrack = Track & { srcUrl: string | null };
type PlaylistDetail = { playlist: Playlist; tracks: PlayableTrack[] };

export type PlaylistSummary = {
  id: string;
  slug: string;
  title: string;
  cover: string | null;
  trackCount: number;
  categoryIds: string[];
  scholar: string | null;
  description: string | null;
};

export type CategorySummary = {
  id: string;
  arSlug: string;
  arName: string;
  enName: string;
};

export type TrackRow = {
  id: string;
  title: string;
  durationSecs: number | null;
  hasAudio: boolean;
};

export type PlaylistDetailData = {
  id: string;
  slug: string;
  title: string;
  cover: string | null;
  scholar: string | null;
  description: string | null;
  categoryIds: string[];
  tracks: TrackRow[];
};

// Shape the server returns for categories (dates are strings after JSON.parse).
type RawCategory = {
  id: string;
  ar: { name: string; slug: string; description?: string };
  en: { name: string; slug: string; description?: string };
  coverMediaId?: string;
  createdAt: string;
  updatedAt: string;
};

// ── Quran ────────────────────────────────────────────────────────────────────

export type QuranSurahSummary = {
  number: number;
  nameAr: string;
  nameEn: string;
  meaning: string;
  ayahCount: number;
  revelationPlace: "meccan" | "medinan";
  // Madani mushaf page (1-604) the surah's first ayah falls on — lets Mushaf
  // mode land on the right page for a surah-number entry point without an
  // extra fetch (packages/api/src/schemas/quran.ts quranSurahSchema.pageStart).
  pageStart: number;
};

export type QuranWord = {
  position: number;
  arabic: string;
  glossEn?: string;
};

export type ReaderAyah = {
  surah: number;
  ayahInSurah: number;
  numberGlobal: number;
  textUthmani: string;
  words: QuranWord[];
  translation: string | null;
  audioUrl: string | null;
  // Madani mushaf page (1-604) + juz (1-30) — already on every ayah the API
  // returns (packages/shared-core/src/schemas/quran.ts readerAyahSchema), just
  // not previously declared on this local view type. Drives Mushaf layout mode.
  page: number;
  juz: number;
};

export type SurahReaderData = {
  surahNumber: number;
  nameAr: string;
  nameEn: string;
  ayahs: ReaderAyah[];
  translationDir: "rtl" | "ltr";
  // false only for At-Tawbah (9) — gates the Mushaf layout's per-page Bismillah
  // (packages/shared-core/src/schemas/quran.ts quranSurahSchema.bismillahPre).
  bismillahPre: boolean;
};

export type QuranReciter = {
  slug: string;
  name: string;
  arabicName?: string;
  image?: string | null;
};
export type QuranEdition = { slug: string; name: string; dir: "rtl" | "ltr" };

type RawSurah = {
  number: number;
  name: { ar: string; en: string };
  meaning: string;
  revelationPlace: "meccan" | "medinan";
  ayahCount: number;
  pageStart: number;
};
type RawSurahReader = {
  surah: { number: number; name: { ar: string; en: string }; bismillahPre: boolean };
  ayahs: ReaderAyah[];
  translationEdition: { dir: "rtl" | "ltr" } | null;
};

// ── Quran — Mushaf (Safha) page mode ────────────────────────────────────────
// GET /api/v1/quran/page/:n returns one Madani mushaf page (1-604), split into
// 1+ per-surah segments (2+ when short surahs share a page, common in juz 30).
// Local view types only — the extension never imports @repo/api.

export type PageSegment = {
  surahNumber: number;
  surahNameAr: string;
  surahNameEn: string;
  bismillahPre: boolean;
  // True iff this segment opens a new surah on the page AND that surah has a
  // Bismillah preface AND it isn't At-Tawbah (9) — computed server-side.
  showBismillah: boolean;
  ayahs: ReaderAyah[];
};

export type PageReaderData = {
  page: number;
  juz: number;
  prevPage: number | null;
  nextPage: number | null;
  segments: PageSegment[];
  translationDir: "rtl" | "ltr";
};

type RawPageSegment = {
  surah: { number: number; name: { ar: string; en: string }; meaning: string; bismillahPre: boolean };
  showBismillah: boolean;
  ayahs: ReaderAyah[];
};
type RawPageReader = {
  page: number;
  juz: number;
  prevPage: number | null;
  nextPage: number | null;
  segments: RawPageSegment[];
  translationEdition: { dir: "rtl" | "ltr" } | null;
};

export async function fetchSurahs(): Promise<QuranSurahSummary[]> {
  const list = await getJson<RawSurah[]>("/quran/surahs");
  return list.map((s) => ({
    number: s.number,
    nameAr: s.name.ar,
    nameEn: s.name.en,
    meaning: s.meaning,
    ayahCount: s.ayahCount,
    revelationPlace: s.revelationPlace,
    pageStart: s.pageStart,
  }));
}

export async function fetchSurahReader(
  surahNumber: number,
  opts: { translation?: string; reciter?: string } = {},
): Promise<SurahReaderData> {
  const r = await getJson<RawSurahReader>(`/quran/surah/${surahNumber}`, {
    locale: LOCALE,
    translation: opts.translation,
    reciter: opts.reciter,
  });
  return {
    surahNumber: r.surah.number,
    nameAr: r.surah.name.ar,
    nameEn: r.surah.name.en,
    ayahs: r.ayahs,
    translationDir: r.translationEdition?.dir ?? "ltr",
    bismillahPre: r.surah.bismillahPre,
  };
}

export async function fetchPageReader(
  page: number,
  opts: { translation?: string; reciter?: string } = {},
): Promise<PageReaderData> {
  const r = await getJson<RawPageReader>(`/quran/page/${page}`, {
    locale: LOCALE,
    translation: opts.translation,
    reciter: opts.reciter,
  });
  return {
    page: r.page,
    juz: r.juz,
    prevPage: r.prevPage,
    nextPage: r.nextPage,
    translationDir: r.translationEdition?.dir ?? "ltr",
    segments: r.segments.map((s) => ({
      surahNumber: s.surah.number,
      surahNameAr: s.surah.name.ar,
      surahNameEn: s.surah.name.en,
      bismillahPre: s.surah.bismillahPre,
      showBismillah: s.showBismillah,
      ayahs: s.ayahs,
    })),
  };
}

export async function fetchReciters(): Promise<QuranReciter[]> {
  const list = await getJson<
    { slug: string; name: string; arabicName?: string; image?: string }[]
  >("/quran/reciters");
  return list.map((r) => ({
    slug: r.slug,
    name: r.name,
    arabicName: r.arabicName,
    image: r.image ? assetUrl(r.image) : null,
  }));
}

// Al-Fatiha (surah 1) as a playable queue in a given reciter's voice — used by
// the home Readers shelf so tapping a reciter plays Al-Fatiha in the background
// (via the shared player) while the surah list stays open to pick anything else.
export async function fetchAlFatihaQueue(reciterSlug: string): Promise<QueueItem[]> {
  const reader = await getJson<{ ayahs: { ayahInSurah: number; audioUrl: string | null }[] }>(
    "/quran/surah/1",
    { reciter: reciterSlug },
  );
  return reader.ayahs
    .filter((a): a is { ayahInSurah: number; audioUrl: string } => a.audioUrl != null)
    .map((a) => ({
      id: `quran:1:${a.ayahInSurah}`,
      url: a.audioUrl,
      title: `Al-Fatiha · ${a.ayahInSurah}`,
    }));
}

export type TafsirData = { editionName: string; dir: "rtl" | "ltr"; html: string };

export async function fetchTafsir(numberGlobal: number): Promise<TafsirData> {
  const r = await getJson<{ edition: { name: string; dir: "rtl" | "ltr" }; html: string }>(
    "/quran/tafsir",
    { ayah: String(numberGlobal), locale: LOCALE },
  );
  return { editionName: r.edition.name, dir: r.edition.dir, html: r.html };
}

export async function fetchEditions(): Promise<QuranEdition[]> {
  const list = await getJson<{ slug: string; name: string; type: string; dir: "rtl" | "ltr" }[]>(
    "/quran/editions",
  );
  return list
    .filter((e) => e.type === "translation")
    .map((e) => ({ slug: e.slug, name: e.name, dir: e.dir }));
}

// ── Adhkar ───────────────────────────────────────────────────────────────────

export type AdhkarKind = "morning" | "evening" | "other";

export type AdhkarSummary = {
  id: string;
  kind: AdhkarKind;
  title: string;
  slug: string;
  itemCount: number;
  repeats: number[];
};

export type DhikrItemView = {
  ar: string;
  en?: string;
  transliteration?: string;
  repeat: number;
  virtue?: string;
  source?: string;
};

export type AdhkarDetail = {
  id: string;
  title: string;
  items: DhikrItemView[];
};

type RawDhikr = {
  ar: string;
  en?: string;
  transliteration?: string;
  repeat: number;
  virtue?: { ar?: string; en?: string };
  source?: { ar?: string; en?: string };
};
type RawAzkar = {
  id: string;
  kind: AdhkarKind;
  ar: { title: string; slug: string };
  en: { title: string; slug: string };
  items: RawDhikr[];
};

export async function fetchAdhkarList(): Promise<AdhkarSummary[]> {
  const list = await getJson<RawAzkar[]>("/adhkar");
  return list.map((a) => ({
    id: a.id,
    kind: a.kind,
    title: a[LOCALE].title,
    slug: a[LOCALE].slug,
    itemCount: a.items.length,
    repeats: a.items.map((i) => i.repeat),
  }));
}

export async function fetchAdhkarBySlug(slug: string): Promise<AdhkarDetail> {
  const a = await getJson<RawAzkar>(`/adhkar/${encodeURIComponent(slug)}`, { locale: LOCALE });
  return {
    id: a.id,
    title: a[LOCALE].title,
    items: a.items.map((i) => ({
      ar: i.ar,
      en: i.en,
      transliteration: i.transliteration,
      repeat: i.repeat,
      virtue: i.virtue?.ar ?? i.virtue?.en,
      source: i.source?.ar ?? i.source?.en,
    })),
  };
}

export async function fetchCategories(): Promise<CategorySummary[]> {
  const list = await getJson<RawCategory[]>("/categories");
  return list.map((c) => ({
    id: c.id,
    arSlug: c.ar.slug,
    arName: c.ar.name,
    enName: c.en.name,
  }));
}

export async function fetchPlaylists(): Promise<PlaylistSummary[]> {
  const list = await getJson<Playlist[]>("/playlists");
  return list.map((p) => ({
    id: p.id,
    slug: p[LOCALE].slug,
    title: p[LOCALE].title,
    cover: p.scholarImage ? assetUrl(p.scholarImage) : null,
    trackCount: p.trackCount ?? 0,
    categoryIds: p.categoryIds,
    scholar: p[LOCALE].scholarName ?? null,
    description: p[LOCALE].description ?? null,
  }));
}

export async function fetchPlaylistDetail(slug: string): Promise<PlaylistDetailData> {
  const detail = await getJson<PlaylistDetail>(`/playlists/${encodeURIComponent(slug)}`, {
    locale: LOCALE,
  });
  const cover = detail.playlist.scholarImage
    ? assetUrl(detail.playlist.scholarImage)
    : null;
  return {
    id: detail.playlist.id,
    slug: detail.playlist[LOCALE].slug,
    title: detail.playlist[LOCALE].title,
    cover,
    scholar: detail.playlist[LOCALE].scholarName ?? null,
    description: detail.playlist[LOCALE].description ?? null,
    categoryIds: detail.playlist.categoryIds,
    tracks: detail.tracks.map((t) => ({
      id: t.id,
      title: t[LOCALE].title,
      durationSecs: t.durationSecs ?? null,
      hasAudio: t.srcUrl != null,
    })),
  };
}

export async function buildPlaylistQueue(
  slug: string,
): Promise<{ queue: QueueItem[]; recent: RecentItem }> {
  const detail = await getJson<PlaylistDetail>(`/playlists/${encodeURIComponent(slug)}`, {
    locale: LOCALE,
  });
  const cover = detail.playlist.scholarImage
    ? assetUrl(detail.playlist.scholarImage)
    : undefined;
  const playlistSlug = detail.playlist[LOCALE].slug;

  const queue: QueueItem[] = detail.tracks.flatMap((t) =>
    t.srcUrl
      ? [
          {
            id: t.id,
            url: t.srcUrl,
            title: t[LOCALE].title,
            artist: detail.playlist[LOCALE].title,
            artwork: cover,
            slug: playlistSlug,
            durationSecs: t.durationSecs,
          },
        ]
      : [],
  );

  return {
    queue,
    recent: {
      slug: playlistSlug,
      title: detail.playlist[LOCALE].title,
      type: "playlist",
      cover,
    },
  };
}

// ── Radio ──────────────────────────────────────────────────────────────────

export type RadioStationSummary = {
  slug: string;
  title: string;
  description: string | null;
  city: string | null;
  streamUrl: string;
  image: string | null;
  isFeatured: boolean;
};

// Server shape for /radio (embedded-locale; dates are strings post-JSON.parse
// but the summary drops them).
type RawStation = {
  slug: string;
  ar: { name: string; description?: string };
  en: { name: string; description?: string };
  city?: string;
  image?: string;
  streamUrl: string;
  isFeatured: boolean;
};

export async function fetchStations(): Promise<RadioStationSummary[]> {
  const list = await getJson<RawStation[]>("/radio");
  return list.map((s) => ({
    slug: s.slug,
    title: s[LOCALE].name,
    description: s[LOCALE].description ?? null,
    city: s.city ?? null,
    streamUrl: s.streamUrl,
    image: s.image ? assetUrl(s.image) : null,
    isFeatured: s.isFeatured,
  }));
}

// A station is a one-item, infinite-duration queue. `isLive` makes the engine
// skip resume-position persistence and the PlayerBar show a LIVE badge.
export function buildStationQueue(station: RadioStationSummary): QueueItem[] {
  return [
    {
      id: `radio:${station.slug}`,
      url: station.streamUrl,
      title: station.title,
      artist: station.city ? `🔴 بث مباشر · ${station.city}` : "🔴 بث مباشر",
      ...(station.image ? { artwork: station.image } : {}),
      slug: station.slug,
      isLive: true,
    },
  ];
}

export async function recordRecent(item: RecentItem): Promise<void> {
  const list = await get("nour.player.recent");
  const next = [item, ...list.filter((r) => r.slug !== item.slug)].slice(0, 20);
  await set("nour.player.recent", next);
}
