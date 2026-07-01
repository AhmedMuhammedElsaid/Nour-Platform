#!/usr/bin/env node

import { disconnectDb, getDb } from "@repo/api/db/client";
import { RadioStationModel } from "@repo/api/db/models/radio-station.model";

import { RADIO_STATIONS } from "./data/radio-data";

// Seeds the radio station catalog. UPSERTS by `slug`: re-running re-applies the
// catalog content (name/description/stream/etc.) while preserving each station's
// `order` and `isLive` toggle on existing rows. New rows default `isLive: true`.
async function main(): Promise<void> {
  await getDb();
  for (const [index, station] of RADIO_STATIONS.entries()) {
    const existing = await RadioStationModel.findOne({ slug: station.slug });
    if (existing) {
      // Dot-path $set so the `ar`/`en` locale subdocs merge (preserve untouched
      // fields) instead of being wholesale-replaced.
      await RadioStationModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            "ar.name": station.ar.name,
            "ar.description": station.ar.description,
            "en.name": station.en.name,
            "en.description": station.en.description,
            country: station.country,
            city: station.city,
            image: station.image,
            streamUrl: station.streamUrl,
            streamType: station.streamType,
            bitrate: station.bitrate,
            language: station.language,
            category: station.category,
            nowPlayingUrl: station.nowPlayingUrl,
            isFeatured: station.isFeatured,
          },
        },
      );
      console.log(`updated: ${station.ar.name}`);
      continue;
    }
    await RadioStationModel.create({
      slug: station.slug,
      order: index,
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
