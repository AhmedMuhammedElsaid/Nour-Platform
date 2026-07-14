#!/usr/bin/env node

import { disconnectDb, getDb } from "@repo/api/db/client";
import { RadioStationModel } from "@repo/api/db/models/radio-station.model";

import { RADIO_STATIONS, RADIO_STATION_ORDER } from "./data/radio-data";

// Full display order: the curated slug list first, then any station not listed
// there, in catalog (array) order. Each station's rank in this list becomes its
// DB `order` (the field the API sorts by, asc).
const ORDERED_SLUGS: string[] = [
  ...RADIO_STATION_ORDER,
  ...RADIO_STATIONS.map((s) => s.slug).filter((s) => !RADIO_STATION_ORDER.includes(s)),
];
const orderOf = (slug: string): number => ORDERED_SLUGS.indexOf(slug);

// Seeds the radio station catalog. UPSERTS by `slug`: re-running re-applies the
// catalog content (name/description/stream/etc.) AND the display `order` (from
// RADIO_STATION_ORDER) on existing rows; the `isLive` toggle is preserved. New
// rows default `isLive: true`.
async function main(): Promise<void> {
  await getDb();
  for (const station of RADIO_STATIONS) {
    const existing = await RadioStationModel.findOne({ slug: station.slug });
    if (existing) {
      // Dot-path $set so the `ar`/`en` locale subdocs merge (preserve untouched
      // fields) instead of being wholesale-replaced. Optional fields absent from
      // the catalog are $unset so a removed value (e.g. dropping a station's
      // `city`) actually clears on the existing row — Mongoose silently ignores
      // `$set: undefined`, which would otherwise leave the stale value in place.
      const set: Record<string, unknown> = {
        "ar.name": station.ar.name,
        "ar.description": station.ar.description,
        "en.name": station.en.name,
        "en.description": station.en.description,
        country: station.country,
        streamUrl: station.streamUrl,
        streamType: station.streamType,
        language: station.language,
        category: station.category,
        isFeatured: station.isFeatured,
        order: orderOf(station.slug),
      };
      const unset: Record<string, ""> = {};
      for (const key of ["city", "image", "bitrate", "nowPlayingUrl"] as const) {
        const value = station[key];
        if (value === undefined) unset[key] = "";
        else set[key] = value;
      }
      await RadioStationModel.updateOne(
        { _id: existing._id },
        Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set },
      );
      console.log(`updated: ${station.ar.name}`);
      continue;
    }
    await RadioStationModel.create({
      slug: station.slug,
      order: orderOf(station.slug),
      isLive: true,
      isFeatured: station.isFeatured,
      ar: { name: station.ar.name, description: station.ar.description },
      en: { name: station.en.name, description: station.en.description },
      country: station.country,
      city: station.city,
      image: station.image,
      streamUrl: station.streamUrl,
      streamType: station.streamType,
      bitrate: station.bitrate,
      language: station.language,
      category: station.category,
      nowPlayingUrl: station.nowPlayingUrl,
    });
    console.log(`seeded: ${station.ar.name}`);
  }
  await disconnectDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
