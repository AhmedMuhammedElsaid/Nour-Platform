// Canonical Quran reciter catalogue — the single source of truth for BOTH the
// full `seed:quran` run and the lightweight `seed:reciters` upsert. Keep this the
// only place reciters are declared so the two scripts never drift.
//
// Each `audioBase` is a verified everyayah.com folder; ayah files follow the
// layout `<audioBase><pad3(surah)><pad3(ayahInSurah)>.mp3` (URLs are COMPUTED at
// read time, never stored). CSP already allows everyayah.com. `arabicName` is the
// AR-locale display label; `image` is an optional static /public path
// (e.g. "/reciters/<slug>.png") — omit it to fall back to a gradient+initials
// avatar on the home "Readers" shelf.
export interface ReciterSeed {
  slug: string;
  name: string;
  arabicName: string;
  audioBase: string;
  image?: string;
}

export const RECITERS: readonly ReciterSeed[] = [
  {
    slug: "alafasy",
    name: "Mishary Rashid Alafasy",
    arabicName: "مشاري راشد العفاسي",
    audioBase: "https://everyayah.com/data/Alafasy_128kbps/",
    image: "/reciters/alafasy.jpg",
  },
  {
    slug: "qatami",
    name: "Nasser Al Qatami",
    arabicName: "ناصر القطامي",
    audioBase: "https://everyayah.com/data/Nasser_Alqatami_128kbps/",
    image: "/reciters/qatami.jpg",
  },
  {
    slug: "abdulbasit",
    name: "Abdul Basit Abdus-Samad",
    arabicName: "عبد الباسط عبد الصمد",
    audioBase: "https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/",
  },
  {
    slug: "sudais",
    name: "Abdur-Rahman As-Sudais",
    arabicName: "عبد الرحمن السديس",
    audioBase: "https://everyayah.com/data/Abdurrahmaan_As-Sudais_192kbps/",
    image: "/reciters/sudais.jpg",
  },
  {
    slug: "husary",
    name: "Mahmoud Khalil Al-Husary",
    arabicName: "محمود خليل الحصري",
    audioBase: "https://everyayah.com/data/Husary_128kbps/",
    image: "/reciters/husary.jpg",
  },
  {
    slug: "minshawi",
    name: "Mohamed Siddiq El-Minshawi",
    arabicName: "محمد صديق المنشاوي",
    audioBase: "https://everyayah.com/data/Minshawy_Murattal_128kbps/",
    image: "/reciters/minshawi.jpg",
  },
  {
    slug: "ghamdi",
    name: "Saad Al-Ghamdi",
    arabicName: "سعد الغامدي",
    audioBase: "https://everyayah.com/data/Ghamadi_40kbps/",
    image: "/reciters/ghamdi.jpg",
  },
  {
    slug: "shatri",
    name: "Abu Bakr Ash-Shatri",
    arabicName: "أبو بكر الشاطري",
    audioBase: "https://everyayah.com/data/Abu_Bakr_Ash-Shaatree_128kbps/",
  },
  {
    slug: "shuraim",
    name: "Saud Ash-Shuraim",
    arabicName: "سعود الشريم",
    audioBase: "https://everyayah.com/data/Saood_ash-Shuraym_128kbps/",
    image: "/reciters/shuraim.jpg",
  },
  {
    slug: "maher",
    name: "Maher Al-Muaiqly",
    arabicName: "ماهر المعيقلي",
    audioBase: "https://everyayah.com/data/Maher_AlMuaiqly_64kbps/",
    image: "/reciters/maher.jpg",
  },
  {
    slug: "hudhaify",
    name: "Ali Al-Hudhaify",
    arabicName: "علي الحذيفي",
    audioBase: "https://everyayah.com/data/Hudhaify_128kbps/",
    image: "/reciters/hudhaify.jpg",
  },
  {
    slug: "ayyoub",
    name: "Muhammad Ayyoub",
    arabicName: "محمد أيوب",
    audioBase: "https://everyayah.com/data/Muhammad_Ayyoub_128kbps/",
  },
  {
    slug: "basfar",
    name: "Abdullah Basfar",
    arabicName: "عبد الله بصفر",
    audioBase: "https://everyayah.com/data/Abdullah_Basfar_192kbps/",
  },
];
