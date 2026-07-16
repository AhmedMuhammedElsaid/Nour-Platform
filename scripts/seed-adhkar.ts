#!/usr/bin/env node

import { disconnectDb, getDb } from "@repo/api/db/client";
import { AzkarModel } from "@repo/api/db/models/azkar.model";
import { slugify } from "@repo/api/utils/slug";

import {
  EVENING_ITEMS,
  MASJID_ITEMS,
  MORNING_ITEMS,
  PRAYER_ITEMS,
  SLEEP_ITEMS,
  WAKE_ITEMS,
} from "./data/adhkar-data";

// Canonical adhkar sets. The seed UPSERTS by Arabic slug: re-running re-applies
// this content, overwriting any manual CMS edits to these sets (intended for a
// content seed). Other sets created in the admin are untouched. The four "other"
// sets are localized (ar + en titles); each item carries Arabic (required) plus
// an English translation where applicable.
//
// Order matters: the first 5 (by this array position) drive the home "Adhkar"
// preview shelf (packages/shared-core/src/adhkar/preview.ts). Mosque is placed
// last so it's excluded from that shelf.
const SETS = [
  {
    kind: "morning" as const,
    ar: { title: "أذكار الصباح" },
    en: { title: "Morning Adhkar" },
    items: MORNING_ITEMS,
  },
  {
    kind: "evening" as const,
    ar: { title: "أذكار المساء" },
    en: { title: "Evening Adhkar" },
    items: EVENING_ITEMS,
  },
  {
    kind: "other" as const,
    ar: { title: "أذكار النوم" },
    en: { title: "Sleep Adhkar" },
    items: SLEEP_ITEMS,
  },
  {
    kind: "other" as const,
    ar: { title: "أذكار الإستيقاظ" },
    en: { title: "Waking Adhkar" },
    items: WAKE_ITEMS,
  },
  {
    kind: "other" as const,
    ar: { title: "أذكار الصلاة" },
    en: { title: "Prayer Adhkar" },
    items: PRAYER_ITEMS,
  },
  {
    kind: "other" as const,
    ar: { title: "اذكار المسجد" },
    en: { title: "Mosque Adhkar" },
    items: MASJID_ITEMS,
  },
];

async function main(): Promise<void> {
  await getDb();
  for (const [index, set] of SETS.entries()) {
    const arSlug = slugify(set.ar.title);
    const existing = await AzkarModel.findOne({ "ar.slug": arSlug });
    if (existing) {
      // Upsert: replace items + titles via dot-paths so the locale subdocs merge,
      // preserving existing slugs. Does not touch `status`, but DOES write `order`
      // (mirroring the radio seed fix) so a re-run applies the curated SETS order
      // above to already-seeded docs — needed for the home preview shelf.
      await AzkarModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            kind: set.kind,
            order: index,
            "ar.title": set.ar.title,
            "en.title": set.en.title,
            items: set.items,
          },
        },
      );
      console.log(`updated: ${set.ar.title} (${set.items.length} items)`);
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
    console.log(`seeded: ${set.ar.title} (${set.items.length} items)`);
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
