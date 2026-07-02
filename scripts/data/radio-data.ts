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
  {
    slug: "haram-makki",
    ar: {
      name: "إذاعة القرآن الكريم – الحرم المكي",
      description: "بث مباشر لتلاوات القرآن الكريم من المسجد الحرام بمكة المكرمة.",
    },
    en: {
      name: "Holy Quran Radio – Makkah Grand Mosque",
      description: "Live Quran recitations from the Grand Mosque in Makkah.",
    },
    country: "SA",
    city: "Makkah",
    streamUrl: "https://edge.mixlr.com/channel/rwumx",
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isFeatured: false,
  },
  {
    slug: "haram-sunnah",
    ar: {
      name: "إذاعة السنة النبوية",
      description: "بث مباشر للسنة النبوية والأحاديث الشريفة على مدار الساعة.",
    },
    en: {
      name: "As-Sunnah An-Nabawiyyah Radio",
      description: "Live 24/7 Prophetic Sunnah and hadith broadcast.",
    },
    country: "SA",
    city: "Makkah",
    streamUrl: "https://radiosunna.radioca.st/stream",
    streamType: "mp3",
    language: "ar",
    category: "islamic",
    isFeatured: false,
  },
  // Additional stations — the iconic voices of Egyptian Quran radio, each a 24/7
  // HTTPS stream (mp3quran/qurango; verified 2026-07-02 end-to-end https,
  // audio/mpeg, no http hop). Adding more later is pure data entry.
  {
    slug: "quran-abdulbasit",
    ar: {
      name: "إذاعة عبد الباسط عبد الصمد",
      description: "تلاوات مجوّدة للشيخ عبد الباسط عبد الصمد على مدار الساعة.",
    },
    en: {
      name: "Abdul Basit Abdul Samad Radio",
      description: "Mujawwad recitations by Sheikh Abdul Basit Abdul Samad, 24/7.",
    },
    country: "EG",
    streamUrl: "https://backup.qurango.net/radio/abdulbasit_abdulsamad_mojawwad",
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isFeatured: false,
  },
  {
    slug: "quran-minshawi",
    ar: {
      name: "إذاعة محمد صديق المنشاوي",
      description: "تلاوات مجوّدة للشيخ محمد صديق المنشاوي على مدار الساعة.",
    },
    en: {
      name: "Mohamed Siddiq El-Minshawi Radio",
      description: "Mujawwad recitations by Sheikh Mohamed Siddiq El-Minshawi, 24/7.",
    },
    country: "EG",
    streamUrl: "https://backup.qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad",
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isFeatured: false,
  },
  {
    slug: "quran-tablawi",
    ar: {
      name: "إذاعة محمد الطبلاوي",
      description: "تلاوات الشيخ محمد الطبلاوي على مدار الساعة.",
    },
    en: {
      name: "Mohamed Al-Tablawi Radio",
      description: "Recitations by Sheikh Mohamed Al-Tablawi, 24/7.",
    },
    country: "EG",
    streamUrl: "https://backup.qurango.net/radio/mohammad_altablaway",
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isFeatured: false,
  },
  {
    slug: "quran-banna",
    ar: {
      name: "إذاعة محمود علي البنا",
      description: "تلاوات الشيخ محمود علي البنا على مدار الساعة.",
    },
    en: {
      name: "Mahmoud Ali Al-Banna Radio",
      description: "Recitations by Sheikh Mahmoud Ali Al-Banna, 24/7.",
    },
    country: "EG",
    streamUrl: "https://backup.qurango.net/radio/mahmoud_ali__albanna",
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isFeatured: false,
  },
];
