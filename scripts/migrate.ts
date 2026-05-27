#!/usr/bin/env node

import { parseArgs } from "node:util";
import { getDb, disconnectDb } from "@repo/api/db/client";
import * as migration0001 from "@repo/api/db/migrations/0001-indexes";
import * as migration0002 from "@repo/api/db/migrations/0002-category-indexes";
import * as migration0003 from "@repo/api/db/migrations/0003-i18n-backfill";
import * as migration0004 from "@repo/api/db/migrations/0004-i18n-indexes";

/*
 * Migration runner for the Nour Platform.
 *
 * Connects to MongoDB, runs all pending migrations in order, then
 * disconnects. Each migration module exports `name: string` and
 * `up(): Promise<void>`. `up()` must be idempotent — it is safe to
 * re-run this script against an already-migrated database.
 *
 * Usage:
 *   pnpm migrate            # run all migrations
 *   pnpm migrate --dry-run  # print which migrations would run; no DB writes
 */

interface Migration {
  name: string;
  up: () => Promise<void>;
}

// Ordered list of all migrations. Append new entries here as waves ship.
// NOTE: 0003 must precede 0001/0002 because PlaylistModel/CategoryModel now
// declare per-locale compound unique indexes ({contentId,locale} etc.) that
// would fail to build while existing documents still have null for those fields.
// 0004 must follow 0003 for the same reason, and before 0001/0002 so the old
// bare-slug unique indexes are dropped before ensureIndexes() rebuilds them
// as compound ones.
const migrations: Migration[] = [
  migration0003,
  migration0004,
  migration0001,
  migration0002,
];

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const isDryRun = values["dry-run"] === true;

  if (isDryRun) {
    console.log("[migrate] dry-run mode — no indexes will be created.\n");
  }

  await getDb();

  try {
    for (const migration of migrations) {
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
