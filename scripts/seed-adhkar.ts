#!/usr/bin/env node

import { disconnectDb, getDb } from "@repo/api/db/client";
import { AzkarModel } from "@repo/api/db/models/azkar.model";
import { slugify } from "@repo/api/utils/slug";

// Minimal vetted starter sets. Expand the items arrays with the full
// Hisnul Muslim text (AR) + a trusted EN translation before go-live.
const SETS = [
  {
    kind: "morning" as const,
    ar: { title: "أذكار الصباح" },
    en: { title: "Morning Adhkar" },
    items: [
      {
        ar: "اللّهُمَّ بِكَ أَصْبَحْنا وَبِكَ أَمْسَيْنا، وَبِكَ نَحْيا وَبِكَ نَموتُ وَإِلَيْكَ النُّشور",
        en: "O Allah, by You we enter the morning and by You we enter the evening, by You we live and by You we die, and to You is the resurrection.",
        repeat: 1,
        source: { ar: "الترمذي ٣٣٩١", en: "At-Tirmidhi 3391" },
      },
      {
        ar: "سُبْحانَ اللهِ وَبِحَمْدِهِ",
        en: "Glory and praise be to Allah",
        repeat: 100,
        virtue: {
          ar: "حُطَّتْ خَطاياهُ وَإِنْ كانَتْ مِثْلَ زَبَدِ البَحْر",
          en: "His sins are wiped away even if they are like the foam of the sea.",
        },
        source: { ar: "البخاري ٦٤٠٥", en: "Al-Bukhari 6405" },
      },
    ],
  },
  {
    kind: "evening" as const,
    ar: { title: "أذكار المساء" },
    en: { title: "Evening Adhkar" },
    items: [
      {
        ar: "اللّهُمَّ بِكَ أَمْسَيْنا وَبِكَ أَصْبَحْنا، وَبِكَ نَحْيا وَبِكَ نَموتُ وَإِلَيْكَ المَصير",
        en: "O Allah, by You we enter the evening and by You we enter the morning, by You we live and by You we die, and to You is the final return.",
        repeat: 1,
        source: { ar: "الترمذي ٣٣٩١", en: "At-Tirmidhi 3391" },
      },
    ],
  },
];

async function main(): Promise<void> {
  await getDb();
  for (const [index, set] of SETS.entries()) {
    const arSlug = slugify(set.ar.title);
    const existing = await AzkarModel.findOne({ "ar.slug": arSlug });
    if (existing) {
      console.log(`skip (exists): ${set.ar.title}`);
      continue;
    }
    await AzkarModel.create({
      kind: set.kind,
      status: "published",
      order: index,
      ar: { title: set.ar.title, slug: arSlug },
      en: { title: set.en.title, slug: slugify(set.en.title) },
      items: set.items,
    });
    console.log(`seeded: ${set.ar.title}`);
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
