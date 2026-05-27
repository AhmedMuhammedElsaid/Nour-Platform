import { getDb } from "../client";
import { PlaylistModel } from "../models/playlist.model";

/*
 * Migration 0002: add Category-related indexes.
 *
 * Two operations:
 *  1. `playlists` collection — non-unique index on `categoryIds` for efficient
 *     "playlists by category" queries added in P2-A.
 *  2. Sync any remaining Mongoose-declared indexes on PlaylistModel (no-op once
 *     0004 has run, but kept for idempotency).
 *
 * NOTE: The bare `categories.slug` unique index originally created here was
 * dropped by 0004 (replaced by the per-locale compound {locale,slug} unique).
 * It is intentionally NOT recreated here — doing so after 0004 would wrongly
 * prevent two locales from sharing the same category slug.
 *
 * The runner (`scripts/migrate.ts`) calls `getDb()` before invoking `up()`, so
 * the connection is already established when this module runs. We call `getDb()`
 * again here only to obtain the `Db` handle for raw collection access — the
 * underlying Mongoose connection is reused (singleton).
 */
export const name = "0002-category-indexes";

export async function up(): Promise<void> {
  const mongoose = await getDb();
  // `getDb()` returns the Mongoose client; the native Db handle lives on
  // `connection.db`. The `!` assertion is safe here — Mongoose sets `db` on
  // the connection object immediately after `connect()` resolves, which is
  // guaranteed by the time `getDb()` returns (see db/client.ts).
  const db = mongoose.connection.db!;

  // 1. playlists.categoryIds — non-unique, for "playlists by category" look-ups
  await db.collection("playlists").createIndex(
    { categoryIds: 1 },
    { name: "playlists_categoryIds" },
  );

  // Sync any additional Mongoose-declared indexes on PlaylistModel (idempotent).
  await PlaylistModel.ensureIndexes();
}
