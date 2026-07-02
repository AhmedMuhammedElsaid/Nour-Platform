#!/usr/bin/env node

import { parseArgs } from "node:util";
import { getDb, disconnectDb } from "@repo/api/db/client";
import { QuranReciterModel } from "@repo/api/db/models/quran-reciter.model";
import { RECITERS } from "./reciter-catalogue";

/*
 * Lightweight, idempotent reciter upsert — syncs the RECITERS catalogue
 * (scripts/reciter-catalogue.ts) into the `quranReciters` collection WITHOUT
 * re-running the heavy full `seed:quran` (6k+ docs + external fetches). Add a
 * reciter to the catalogue, then run this to make it available on all surfaces.
 *
 * Run: pnpm seed:reciters          (dry-run by default)
 *      pnpm seed:reciters --apply  (writes)
 */

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { apply: { type: "boolean" }, help: { type: "boolean", short: "h" } },
    strict: true,
  });
  if (values.help) {
    console.log(
      "Usage: pnpm seed:reciters [--apply]\n" +
        "Upserts the reciter catalogue into quranReciters. Idempotent.\n" +
        "Dry-run unless --apply is passed.",
    );
    process.exit(0);
  }

  await getDb();
  try {
    for (const r of RECITERS) {
      const set: Record<string, string> = {
        slug: r.slug,
        name: r.name,
        arabicName: r.arabicName,
        audioBase: r.audioBase,
      };
      if (r.image) set.image = r.image;

      if (!values.apply) {
        console.log(`[seed:reciters] (dry-run) upsert ${r.slug} — ${r.name}`);
        continue;
      }
      const res = await QuranReciterModel.updateOne(
        { slug: r.slug },
        { $set: set },
        { upsert: true },
      );
      const action = res.upsertedCount > 0 ? "inserted" : "updated";
      console.log(`[seed:reciters] ${r.slug} ${action}`);
    }
    console.log(
      values.apply
        ? `[seed:reciters] done — ${RECITERS.length} reciters synced.`
        : `[seed:reciters] dry-run complete (${RECITERS.length} reciters) — re-run with --apply to write.`,
    );
  } finally {
    await disconnectDb();
  }
}

void main();
