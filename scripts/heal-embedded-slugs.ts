#!/usr/bin/env node

import { getDb, disconnectDb } from "@repo/api/db/client";
import * as migration0005 from "@repo/api/db/migrations/0005-embedded-locale";

/*
 * One-off heal for embedded-locale slugs.
 *
 * Runs ONLY migration 0005's `up()` in isolation. 0005 is idempotent: on an
 * already-embedded database its merge loops no-op, its `backfillSlugs()` pass
 * mints a slug from title/name for any doc with a missing/empty `ar`/`en` slug,
 * and it drops+rebuilds the slug indexes safely.
 *
 * Why isolation (NOT `pnpm migrate`): the full chain runs 0003 first, which
 * matches `{ locale: { $exists: false } }` — true for every embedded doc — and
 * would WRONGLY re-add `locale`/`contentId`, corrupting the embedded shape.
 * Never run the full chain against already-embedded data. This script is the
 * safe path to heal docs that lost slugs (e.g. via the old subdoc-clobber bug)
 * or a restored dump.
 *
 * Usage:
 *   pnpm heal:slugs
 */
async function main(): Promise<void> {
  await getDb();
  try {
    console.log(`[heal] running: ${migration0005.name} …`);
    await migration0005.up();
    console.log("[heal] done. All ar/en slugs backfilled; indexes rebuilt.");
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error("[heal] fatal error:", err);
  process.exit(1);
});
