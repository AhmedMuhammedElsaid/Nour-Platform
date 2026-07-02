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
};

export type SurahReaderData = {
  surahNumber: number;
  nameAr: string;
  nameEn: string;
  ayahs: ReaderAyah[];
  translationDir: "rtl" | "ltr";
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
};
type RawSurahReader = {
  surah: { number: number; name: { ar: string; en: string } };
  ayahs: ReaderAyah[];
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

export async function recordRecent(item: RecentItem): Promise<void> {
  const list = await get("nour.player.recent");
  const next = [item, ...list.filter((r) => r.slug !== item.slug)].slice(0, 20);
  await set("nour.player.recent", next);
}
