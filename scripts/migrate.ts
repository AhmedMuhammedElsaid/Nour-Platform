#!/usr/bin/env node

import { parseArgs } from "node:util";
import { getDb, disconnectDb } from "@repo/api/db/client";
import * as migration0001 from "@repo/api/db/migrations/0001-indexes";
import * as migration0002 from "@repo/api/db/migrations/0002-category-indexes";
import * as migration0003 from "@repo/api/db/migrations/0003-i18n-backfill";
import * as migration0004 from "@repo/api/db/migrations/0004-i18n-indexes";
import * as migration0005 from "@repo/api/db/migrations/0005-embedded-locale";
import * as migration0006 from "@repo/api/db/migrations/0006-search-indexes";
import * as migration0007 from "@repo/api/db/migrations/0007-playlist-order";
import * as migration0008 from "@repo/api/db/migrations/0008-azkar-indexes";
import * as migration0009 from "@repo/api/db/migrations/0009-quran-indexes";
import * as migration0010 from "@repo/api/db/migrations/0010-quran-tafsir-indexes";

/*
 * Migration runner for the Nour Platform.
 *
 * Connects to MongoDB, runs all pending migrations in order, then
 * disconnects. Each migration module exports `name: string` and
 * `up(): Promise<void>`. `up()` must be idempotent — it is safe to
 * re-run this script against an already-migrated database.
 *
 * Usage:
 *   pnpm migrate                            # run the steady-state chain
 *   pnpm migrate --dry-run                  # print which migrations would run; no DB writes
 *   pnpm migrate --only 0008-azkar-indexes  # run a single migration (steady-state or legacy) in isolation
 *
 * The default chain is steady-state only — safe to run in full against any
 * embedded-locale DB (fresh or production). One-time embedded-locale
 * transforms (0003/0004/0005) are legacy and excluded from the default chain;
 * reach them only via --only for historical/dev-restore scenarios.
 */

interface Migration {
  name: string;
  up: () => Promise<void>;
}

// Steady-state chain: safe to run in full against any embedded-locale DB
// (fresh or production). Append new migrations here.
const migrations: Migration[] = [
  migration0001,
  migration0002,
  migration0006, // text-search indexes — additive, no document changes
  migration0007, // backfill playlist.order; registers { order,1 } and { status,order } indexes
  migration0008, // azkar indexes — unique ar/en slug, { status,order }, { order }
  migration0009, // quran indexes — additive ensureIndexes on Quran collections (run with --only)
  migration0010, // quran tafsir index — additive
];

// One-time embedded-locale transforms (2026-05). Excluded from the default
// chain; reachable only via --only for historical/dev-restore scenarios.
// 0003 additionally self-guards against embedded documents.
const legacyMigrations: Migration[] = [migration0003, migration0004, migration0005];

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      only: { type: "string" },
    },
    strict: true,
  });

  const isDryRun = values["dry-run"] === true;
  const only = values.only;

  let toRun = migrations;
  if (only !== undefined) {
    const all = [...migrations, ...legacyMigrations];
    toRun = all.filter((m) => m.name === only);
    if (toRun.length === 0) {
      console.error(
        `[migrate] no migration named "${only}". Known names:\n` +
          all.map((m) => `  - ${m.name}`).join("\n"),
      );
      process.exit(1);
    }
    if (legacyMigrations.some((m) => m.name === only)) {
      console.warn(`[migrate] ⚠️ "${only}" is a LEGACY one-time transform.`);
    }
    console.log(`[migrate] --only: running just "${only}".\n`);
  }

  if (isDryRun) {
    console.log("[migrate] dry-run mode — no indexes will be created.\n");
  }

  await getDb();

  try {
    for (const migration of toRun) {
      if (isDryRun) {
        console.log(`[migrate] would run: ${migration.name}`);
        continue;
      }

      console.log(`[migrate] running: ${migration.name} …`);
      await migration.up();
      console.log(`[migrate] done:    ${migration.name}`);
    }

    console.log(
      isDryRun
        ? "\n[migrate] dry-run complete. No changes made."
        : "\n[migrate] all migrations applied successfully.",
    );
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error("[migrate] fatal error:", err);
  process.exit(1);
});
