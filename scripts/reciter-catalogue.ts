// Canonical Quran reciter catalogue — the single source of truth for BOTH the
// full `seed:quran` run and the lightweight `seed:reciters` upsert. Keep this the
// only place reciters are declared so the two scripts never drift.
//
// Each `audioBase` is a verified everyayah.com folder; ayah files follow the
// layout `<audioBase><pad3(surah)><pad3(ayahInSurah)>.mp3` (URLs are COMPUTED at
// read time, never stored). CSP already allows everyayah.com. `arabicName` is the
// AR-locale display label; `image` is an optional static /public path
// (e.g. "/reciters/<slug>.png") — omit it to fall back to a gradient+initials
// avatar on the home "Readers" shelf. `order` controls the display order on the
// shelves (ascending; the repo sorts by `order` then `name`) — this array is kept
// in that same order for readability, but `order` is the source of truth.
export interface ReciterSeed {
  slug: string;
  name: string;
  arabicName: string;
  audioBase: string;
  order: number;
  image?: string;
}

export const RECITERS: readonly ReciterSeed[] = [
  {
    slug: "abdulbasit",
    name: "Abdul Basit Abdus-Samad",
    arabicName: "عبد الباسط عبد الصمد",
    audioBase: "https://everyayah.com/data/Abdul_Basit_Murattal_192kbps/",
    image: "/reciters/abdulbasit.jpg",
    order: 1,
  },
  {
    slug: "minshawi",
    name: "Mohamed Siddiq El-Minshawi",
    arabicName: "محمد صديق المنشاوي",
    audioBase: "https://everyayah.com/data/Minshawy_Murattal_128kbps/",
    image: "/reciters/minshawi.jpg",
    order: 2,
  },
  {
    slug: "husary",
    name: "Mahmoud Khalil Al-Husary",
    arabicName: "محمود خليل الحصري",
    audioBase: "https://everyayah.com/data/Husary_128kbps/",
    image: "/reciters/husary.jpg",
    order: 3,
  },
  {
    slug: "mustafaismail",
    name: "Mustafa Ismail",
    arabicName: "مصطفى إسماعيل",
    audioBase: "https://everyayah.com/data/Mustafa_Ismail_48kbps/",
    image: "/reciters/mustafaismail.jpg",
    order: 4,
  },
  {
    slug: "alijaber",
    name: "Ali Abdullah Jaber",
    arabicName: "علي عبد الله جابر",
    audioBase: "https://everyayah.com/data/Ali_Jaber_64kbps/",
    image: "/reciters/alijaber.jpg",
    order: 5,
  },
  {
    slug: "maher",
    name: "Maher Al-Muaiqly",
    arabicName: "ماهر المعيقلي",
    audioBase: "https://everyayah.com/data/Maher_AlMuaiqly_64kbps/",
    image: "/reciters/maher.jpg",
    order: 6,
  },
  {
    slug: "qatami",
    name: "Nasser Al Qatami",
    arabicName: "ناصر القطامي",
    audioBase: "https://everyayah.com/data/Nasser_Alqatami_128kbps/",
    image: "/reciters/qatami.jpg",
    order: 7,
  },
  {
    slug: "alafasy",
    name: "Mishary Rashid Alafasy",
    arabicName: "مشاري راشد العفاسي",
    audioBase: "https://everyayah.com/data/Alafasy_128kbps/",
    image: "/reciters/alafasy.jpg",
    order: 8,
  },
  {
    slug: "ghamdi",
    name: "Saad Al-Ghamdi",
    arabicName: "سعد الغامدي",
    audioBase: "https://everyayah.com/data/Ghamadi_40kbps/",
    image: "/reciters/ghamdi.jpg",
    order: 9,
  },
  {
    slug: "sudais",
    name: "Abdur-Rahman As-Sudais",
    arabicName: "عبد الرحمن السديس",
    audioBase: "https://everyayah.com/data/Abdurrahmaan_As-Sudais_192kbps/",
    image: "/reciters/sudais.jpg",
    order: 10,
  },
  {
    slug: "shuraim",
    name: "Saud Ash-Shuraim",
    arabicName: "سعود الشريم",
    audioBase: "https://everyayah.com/data/Saood_ash-Shuraym_128kbps/",
    image: "/reciters/shuraim.jpg",
    order: 11,
  },
  {
    slug: "shatri",
    name: "Abu Bakr Ash-Shatri",
    arabicName: "أبو بكر الشاطري",
    audioBase: "https://everyayah.com/data/Abu_Bakr_Ash-Shaatree_128kbps/",
    image: "/reciters/shatri.jpg",
    order: 12,
  },
  {
    slug: "hudhaify",
    name: "Ali Al-Hudhaify",
    arabicName: "علي الحذيفي",
    audioBase: "https://everyayah.com/data/Hudhaify_128kbps/",
    image: "/reciters/hudhaify.jpg",
    order: 13,
  },
  {
    slug: "ayyoub",
    name: "Muhammad Ayyoub",
    arabicName: "محمد أيوب",
    audioBase: "https://everyayah.com/data/Muhammad_Ayyoub_128kbps/",
    image: "/reciters/ayyoub.jpg",
    order: 14,
  },
  {
    slug: "basfar",
    name: "Abdullah Basfar",
    arabicName: "عبد الله بصفر",
    audioBase: "https://everyayah.com/data/Abdullah_Basfar_192kbps/",
    image: "/reciters/basfar.jpg",
    order: 15,
  },
];
