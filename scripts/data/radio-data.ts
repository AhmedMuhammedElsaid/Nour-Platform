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
    // 2026-07-05 CORRECTION (owner-confirmed by listening): this entry was
    // seeded as "quran-rifat" but the stream is NOT Sheikh Mohamed Rifat
    // reciting Quran — it's recorded lectures/durus by Sheikh Muhammad Rateb
    // Al-Nabulsi. Renamed honestly; category moved quran → islamic (lectures,
    // not recitation). Slug changed (was never applied to Atlas, so no
    // favorites/recents are orphaned). streamUrl unchanged — still a valid,
    // verified Zeno.FM mount (stream.zeno.fm 302s to *.surfernetwork.com,
    // already in CSP RADIO_ORIGINS). The real Sheikh Mohamed Rifat station is
    // the separate `quran-rifat` entry below.
    slug: "nabulsi-lectures",
    ar: {
      name: "دروس الشيخ محمد راتب النابلسي",
      description: "دروس ومحاضرات الشيخ محمد راتب النابلسي على مدار الساعة.",
    },
    en: {
      name: "Sheikh Muhammad Rateb Al-Nabulsi Lectures",
      description: "Recorded lectures and lessons by Sheikh Muhammad Rateb Al-Nabulsi, 24/7.",
    },
    country: "SY",
    streamUrl: "https://stream.zeno.fm/1fatuk10fkhvv",
    streamType: "mp3",
    language: "ar",
    category: "islamic",
    isFeatured: false,
  },
  {
    // The REAL Sheikh Mohamed Rifat (محمد رفعت, 1882–1950) — pioneering voice
    // of Egyptian Quran radio (his was the first recitation broadcast when
    // Egyptian radio launched in 1934). No qurango/mp3quran mount exists for
    // him. This is a direct HTTPS-native Shoutcast stream from mp3islam.com
    // (verified 7/8 end-to-end https, audio/mpeg, no http hop; identity
    // confirmed via live ICY StreamTitle: "Mohammad Refat محمد رفعت - 012
    // Yusuf يوسف"). An earlier Zeno.FM mount tried for this slug
    // (stream.zeno.fm/toyii0eewivtv, relaying the same mp3islam origin) was
    // intermittently 503 "Mount point not active" — using the origin
    // directly instead.
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
    streamUrl: "https://radio.mp3islam.com/listen/refaat/radio.mp3",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "quran",
    isFeatured: false,
  },
  {
    // Sheikh Muhammad Metwalli Al-Sha'rawi (محمد متولي الشعراوي) — his tafsir
    // read/rebroadcast on a dedicated Zeno.FM station (verified 3/3 end-to-end
    // https, audio/mpeg; identity confirmed via live ICY StreamTitle, a named
    // episode of tafsir attributed to "الشيخ محمد متولي الشعراوي" — stream.zeno.fm
    // 302s to *.surfernetwork.com, already in CSP RADIO_ORIGINS).
    slug: "sharawi-lectures",
    ar: {
      name: "إذاعة الشيخ الشعراوي",
      description: "دروس وتفسير الشيخ محمد متولي الشعراوي على مدار الساعة.",
    },
    en: {
      name: "Sheikh Al-Sha'rawi Radio",
      description: "Lectures and Quran commentary by Sheikh Muhammad Metwalli Al-Sha'rawi, 24/7.",
    },
    country: "EG",
    streamUrl: "https://stream.zeno.fm/guuggdfrvssuv",
    streamType: "mp3",
    language: "ar",
    category: "islamic",
    isFeatured: false,
  },
  {
    // Tawasheeh/ibtihalat station on Zeno.FM, page-labeled "سيد النقشبندي"
    // (Sayed Al-Naqshbandi); verified 3/3 end-to-end https, audio/aac —
    // identity confirmed via live ICY StreamTitle for a known Naqshbandi-style
    // ibtihal ("أشرق الكون بالهدى وأطمئن"). ⚠️ Naqshbandi and Nasruddin Tobar
    // are commonly paired in tawasheeh compilations/playlists, but only a
    // single track was sampled live (long-running track; no rotation change
    // observed in ~100s) — Tobar's presence in this station's rotation is
    // NOT independently confirmed. If the owner listens and it's Naqshbandi-only,
    // rename/re-describe accordingly.
    slug: "tawasheeh",
    ar: {
      name: "إذاعة التواشيح والابتهالات",
      description: "تواشيح وابتهالات دينية، منها للشيخ سيد النقشبندي، على مدار الساعة.",
    },
    en: {
      name: "Tawasheeh & Ibtihalat Radio",
      description: "Religious chants and supplications, including Sayed Al-Naqshbandi, 24/7.",
    },
    country: "EG",
    streamUrl: "https://stream.zeno.fm/s0vc98c0pnhvv",
    streamType: "aac",
    language: "ar",
    category: "islamic",
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
  // Thematic Seerah/Sahaba/Prophets-stories stations added 2026-07-16 — same
  // qurango network as 7 of the entries above (verified via curl -I: 200,
  // audio/mpeg, Icy-Br 128, https end-to-end; host already in CSP RADIO_ORIGINS,
  // no CSP change needed). No dedicated 24/7 stream exists under the literal
  // names "يوم في حياة النبي"/"غزوات الرسول" (those are episodic
  // lectures/podcasts, not live radio brands) — the two Seerah stations below
  // are the closest real substitute (owner-confirmed).
  {
    slug: "seerah-fi-zilal",
    ar: {
      name: "في ظلال السيرة النبوية",
      description: "سلسلة من 400 حلقة عن السيرة النبوية على مدار الساعة.",
    },
    en: {
      name: "In the Shadows of the Prophet's Seerah",
      description: "A 400-episode series on the Prophet's biography, 24/7.",
    },
    country: "SA",
    streamUrl: "https://backup.qurango.net/radio/fi_zilal_alsiyra",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "islamic",
    isFeatured: false,
  },
  {
    slug: "seerah-mukhtasar",
    ar: {
      name: "المختصر في السيرة النبوية",
      description: "عرض مختصر للسيرة النبوية على مدار الساعة.",
    },
    en: {
      name: "The Concise Seerah",
      description: "A concise account of the Prophet's biography, 24/7.",
    },
    country: "SA",
    streamUrl: "https://backup.qurango.net/radio/almukhtasar_fi_alsiyra",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "islamic",
    isFeatured: false,
  },
  {
    slug: "sahaba-stories",
    ar: {
      name: "صور من حياة الصحابة والتابعين",
      description: "قصص وصور من حياة الصحابة والتابعين رضوان الله عليهم على مدار الساعة.",
    },
    en: {
      name: "Scenes from the Lives of the Companions",
      description: "Stories from the lives of the Prophet's Companions and their followers, 24/7.",
    },
    country: "SA",
    streamUrl: "https://backup.qurango.net/radio/sahabah",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "islamic",
    isFeatured: false,
  },
  {
    slug: "prophets-stories",
    ar: {
      name: "قصص الأنبياء",
      description: "قصص الأنبياء عليهم السلام على مدار الساعة.",
    },
    en: {
      name: "Stories of the Prophets",
      description: "Stories of the Prophets, peace be upon them, 24/7.",
    },
    country: "SA",
    streamUrl: "https://backup.qurango.net/radio/alanbiya",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "islamic",
    isFeatured: false,
  },
  {
    slug: "shamail-nabawiyyah",
    ar: {
      name: "الشمائل المحمدية",
      description: "صفات وشمائل النبي صلى الله عليه وسلم على مدار الساعة.",
    },
    en: {
      name: "Ash-Shama'il Al-Muhammadiyyah",
      description: "The Prophet's noble characteristics and description, 24/7.",
    },
    country: "SA",
    streamUrl: "https://backup.qurango.net/radio/shmaeel",
    streamType: "mp3",
    bitrate: 128,
    language: "ar",
    category: "islamic",
    isFeatured: false,
  },
];

// Display order (top → bottom) shown on every surface (web/mobile/extension all
// read the `order`-sorted `/api/v1/radio`). The seed maps each slug's position
// here to the DB `order` field. Any station whose slug is NOT listed keeps its
// catalog (array) position, appended after all listed ones. To reorder: edit
// this list, then re-run `pnpm seed:radio` on Atlas (the seed now updates
// `order` on existing rows, not only new ones).
export const RADIO_STATION_ORDER: string[] = [
  // First 4 = the home-page preview shelf (web/mobile/ext all slice the
  // first PREVIEW_COUNT=4 of this order-sorted list) — owner-curated 2026-07-16.
  "quran-cairo-live",
  "sahaba-stories",
  "seerah-mukhtasar",
  "sharawi-lectures",
  "quran-abdulbasit",
  "quran-minshawi",
  "tawasheeh",
  "quran-rifat",
  "seerah-fi-zilal",
  "prophets-stories",
  "shamail-nabawiyyah",
];
