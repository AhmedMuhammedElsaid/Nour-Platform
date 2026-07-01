#!/usr/bin/env node

import { parseArgs } from "node:util";
import { getDb, disconnectDb } from "@repo/api/db/client";
import { QuranReciterModel } from "@repo/api/db/models/quran-reciter.model";

/*
 * Lightweight, idempotent backfill for the `arabicName` (and optional `image`)
 * fields added to reciter docs — enriches EXISTING quranReciters without
 * re-running the heavy full `seed:quran` (6k+ docs + external fetches).
 *
 * Photos: drop files in `apps/web/public/reciters/<slug>.png` and set `image`
 * to that path below. Leave `image` undefined to fall back to a gradient+initials
 * avatar on the home "Readers" shelf. Mobile + extension resolve the same path
 * through the web origin via `assetUrl()`.
 *
 * Run: pnpm backfill:reciter-meta          (dry-run by default)
 *      pnpm backfill:reciter-meta --apply  (writes)
 */

// slug → metadata to set. Keep in sync with the RECITERS catalogue in
// scripts/seed-quran.ts (that seed is the canonical source for fresh installs;
// this script heals already-seeded Atlas data).
const RECITER_META: Record<string, { arabicName?: string; image?: string }> = {
  alafasy: { arabicName: "مشاري راشد العفاسي" },
  qatami: { arabicName: "ناصر القطامي" },
};

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { apply: { type: "boolean" }, help: { type: "boolean", short: "h" } },
    strict: true,
  });
  if (values.help) {
    console.log(
      "Usage: pnpm backfill:reciter-meta [--apply]\n" +
        "Sets arabicName/image on existing quranReciters docs. Idempotent.\n" +
        "Dry-run unless --apply is passed.",
    );
    process.exit(0);
  }

  await getDb();
  try {
    for (const [slug, meta] of Object.entries(RECITER_META)) {
      const set: Record<string, string> = {};
      if (meta.arabicName) set.arabicName = meta.arabicName;
      if (meta.image) set.image = meta.image;
      if (Object.keys(set).length === 0) continue;

      if (!values.apply) {
        console.log(`[backfill:reciter-meta] (dry-run) ${slug} <- ${JSON.stringify(set)}`);
        continue;
      }
      const res = await QuranReciterModel.updateOne({ slug }, { $set: set });
      console.log(
        `[backfill:reciter-meta] ${slug} matched=${res.matchedCount} modified=${res.modifiedCount}`,
      );
    }
    if (!values.apply) {
      console.log("[backfill:reciter-meta] dry-run complete — re-run with --apply to write.");
    }
  } finally {
    await disconnectDb();
  }
}

void main();
