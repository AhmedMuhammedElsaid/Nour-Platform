// Radio station catalog for `pnpm seed:radio`. Adding a station later is a
// data-entry task: append a row here (or, once admin CRUD lands, add it in the
// CMS) and re-run the seed. The seed UPSERTS by `slug`.
//
// streamUrl values must be verified working + embeddable before they reach real
// users. Override any entry at seed time without editing code via an env var
// (e.g. RADIO_CAIRO_STREAM_URL) — handy for swapping a dead stream.

export type RadioStationSeed = {
  slug: string;
  ar: { name: string; description?: string };
  en: { name: string; description?: string };
  country: string;
  city?: string;
  image?: string;
  streamUrl: string;
  streamType: "mp3" | "aac" | "hls";
  bitrate?: number;
  language: string;
  category: "quran" | "islamic";
  nowPlayingUrl?: string;
  isFeatured: boolean;
};

export const RADIO_STATIONS: RadioStationSeed[] = [
  {
    slug: "quran-cairo",
    ar: {
      name: "إذاعة القرآن الكريم – القاهرة",
      description: "إذاعة القرآن الكريم من القاهرة — بث مباشر على مدار الساعة.",
    },
    en: {
      name: "Holy Quran Radio – Cairo",
      description: "The Holy Quran Radio from Cairo — 24/7 live broadcast.",
    },
    country: "EG",
    city: "Cairo",
    streamUrl:
      process.env.RADIO_CAIRO_STREAM_URL ??
      // Verified 2026-07-02: Cairo Quran Radio 98.2 FM (radiojar mount
      // 8s5u5tpdtwzuv). Tokenless base URL — radiojar 302s to a per-connection
      // edge token; serves audio/mpeg. Same mount Radio Garden resolves to.
      "https://stream.radiojar.com/8s5u5tpdtwzuv",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "quran",
    isFeatured: true,
  },
];
