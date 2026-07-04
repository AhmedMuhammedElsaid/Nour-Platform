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
    // Sheikh Mahmoud Khalil Al-Husary (الشيخ محمود خليل الحصري) — the signature
    // voice of Egyptian Quran radio, 24/7 over HTTPS (mp3quran/qurango; verified
    // end-to-end https, audio/mpeg). This entry used to be a stand-in named "Holy
    // Quran Radio – Cairo" (the authentic Cairo broadcast has no HTTPS feed — see
    // `quran-cairo-live` below); now that the real Cairo station is its own entry,
    // this is renamed honestly to its actual reciter and is just another reciter
    // station (like abdulbasit/minshawi). Slug kept `quran-cairo` so existing
    // favorites/recents and the seeded Atlas row aren't orphaned.
    slug: "quran-cairo",
    ar: {
      name: "إذاعة الشيخ محمود خليل الحصري",
      description: "تلاوات الشيخ محمود خليل الحصري على مدار الساعة.",
    },
    en: {
      name: "Sheikh Mahmoud Khalil Al-Husary Radio",
      description: "Recitations by Sheikh Mahmoud Khalil Al-Husary, 24/7.",
    },
    country: "EG",
    streamUrl: "https://backup.qurango.net/radio/mahmoud_khalil_alhussary",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "quran",
    isFeatured: false,
  },
  {
    // The ACTUAL live إذاعة القرآن الكريم broadcast from Cairo (Quran FM 98.2,
    // holyquranradio.com) — the featured flagship station.
    // ⚠️ The station's own feed is radiojar (stream.radiojar.com/8s5u5tpdtwzuv),
    // which is HTTP-ONLY — it 302s to an insecure http://n*.radiojar.com edge
    // (re-verified 2026-07-03), so it can't play over HTTPS/CSP/Android-cleartext.
    // No official HTTPS origin exists. This points at a reliable HTTPS *re-broadcast*
    // of the Cairo Quran radio on Zeno.FM (verified 4/4 end-to-end https, audio/mpeg;
    // stream.zeno.fm 302s to *.surfernetwork.com — both allowed in CSP RADIO_ORIGINS).
    // Swap to a different mount or the official feed anytime via the streamUrl here,
    // or without a code change via the RADIO_CAIRO_LIVE_STREAM_URL env override.
    slug: "quran-cairo-live",
    ar: {
      name: "إذاعة القرآن الكريم من القاهرة – بث مباشر",
      description: "البث المباشر لإذاعة القرآن الكريم من القاهرة (إف إم 98.2) على مدار الساعة.",
    },
    en: {
      name: "Holy Quran Radio from Cairo – Live",
      description: "The live 24/7 broadcast of Holy Quran Radio from Cairo (FM 98.2).",
    },
    country: "EG",
    city: "Cairo",
    streamUrl:
      process.env.RADIO_CAIRO_LIVE_STREAM_URL ??
      "https://stream.zeno.fm/ru2hqnplhk7uv",
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isFeatured: true,
  },
  {
    // The authentic 24/7 Grand Mosque broadcast is radiojar HTTP-only (same wall
    // the Cairo entry hit — unusable over HTTPS/CSP). The previous mixlr channel
    // (edge.mixlr.com/channel/rwumx) was actually a personal reciter channel
    // (Islam Sobhy) that dropped offline, so it read as "not working". Replaced
    // 2026-07-03 with the recitations of Sheikh Abdul Rahman Al-Sudais — chief
    // imam of the Grand Mosque, so the station stays genuinely Haram-associated —
    // over a reliable 24/7 HTTPS mount (qurango; verified 4/4 end-to-end https,
    // audio/mpeg).
    slug: "haram-makki",
    ar: {
      name: "إذاعة الحرم المكي – الشيخ السديس",
      description: "تلاوات الشيخ عبد الرحمن السديس، إمام المسجد الحرام، على مدار الساعة.",
    },
    en: {
      name: "Makkah Haram Radio – Sheikh Al-Sudais",
      description: "Recitations by Sheikh Abdul Rahman Al-Sudais, Imam of the Grand Mosque, 24/7.",
    },
    country: "SA",
    city: "Makkah",
    streamUrl: "https://backup.qurango.net/radio/abdulrahman_alsudaes",
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
  {
    // Sheikh Mohamed Rifat (محمد رفعت, 1882–1950) — the pioneering voice of
    // Egyptian Quran radio (his was the first recitation broadcast when Egyptian
    // radio launched in 1934). No qurango/mp3quran mount exists for him; this is a
    // dedicated 24/7 HTTPS re-broadcast on Zeno.FM ("راديو القرآن - محمد رفعت";
    // verified 3/3 end-to-end https, audio/mpeg — stream.zeno.fm 302s to
    // *.surfernetwork.com, both already in CSP RADIO_ORIGINS).
    slug: "quran-rifat",
    ar: {
      name: "إذاعة الشيخ محمد رفعت",
      description: "تلاوات الشيخ محمد رفعت، رائد قرّاء الإذاعة المصرية، على مدار الساعة.",
    },
    en: {
      name: "Sheikh Mohamed Rifat Radio",
      description: "Recitations by Sheikh Mohamed Rifat, pioneer of Egyptian radio reciters, 24/7.",
    },
    country: "EG",
    streamUrl: "https://stream.zeno.fm/1fatuk10fkhvv",
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isFeatured: false,
  },
  {
    // A rotating mix of leading reciters — one reliable 24/7 HTTPS stream
    // (qurango `mix` mount; verified 4/4 end-to-end https, audio/mpeg).
    slug: "quran-mix",
    ar: {
      name: "إذاعة تلاوات منوّعة",
      description: "باقة من تلاوات كبار القرّاء تتنوّع على مدار الساعة.",
    },
    en: {
      name: "Assorted Recitations Radio",
      description: "A rotating selection of leading reciters, 24/7.",
    },
    country: "SA",
    streamUrl: "https://backup.qurango.net/radio/mix",
    streamType: "mp3",
    language: "ar",
    category: "quran",
    isFeatured: false,
  },
];
