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
      // The authentic Cairo broadcast (إذاعة القرآن الكريم, radiojar mount
      // 8s5u5tpdtwzuv) is HTTP-ONLY: every connection 302s to an insecure
      // http://n*.radiojar.com edge, which browsers (mixed-content), Android
      // (cleartext), and our CSP all block — so it can't play on any surface and
      // a Vercel proxy can't hold a 24/7 stream. Until an HTTPS Cairo feed exists
      // (e.g. a Zeno.FM mount — drop it in via RADIO_CAIRO_STREAM_URL, no code
      // change; CSP already allows *.zeno.fm), default to the signature voice of
      // Egyptian Quran radio: Sheikh Mahmoud Khalil Al-Husary, 24/7 over HTTPS
      // (mp3quran/qurango). Verified 2026-07-02: end-to-end https, audio/mpeg.
      "https://backup.qurango.net/radio/mahmoud_khalil_alhussary",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "quran",
    isFeatured: true,
  },
];
