import { getDb } from "../client";
import { PlaylistModel } from "../models/playlist.model";

/*
 * Migration 0002: add Category-related indexes.
 *
 * Two operations:
 *  1. `categories` collection — unique slug index. The CategoryModel does not
 *     exist yet when this migration runs (it ships as part of P2-A), so we
 *     target the raw collection via `getDb()`. MongoDB's `createIndex` is
 *     idempotent: re-running this migration against an already-indexed DB is a
 *     no-op.
 *  2. `playlists` collection — non-unique index on `categoryIds` to support
 *     efficient "playlists by category" queries added in P2-A. Delegated to
 *     `PlaylistModel.ensureIndexes()` once the field is declared in the schema;
 *     for forward-safety we also ensure it here via the raw collection.
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

  // 1. categories.slug — unique
  await db.collection("categories").createIndex(
    { slug: 1 },
    { unique: true, name: "categories_slug_unique" },
  );

  // 2. playlists.categoryIds — non-unique, for "playlists by category" look-ups
  await db.collection("playlists").createIndex(
    { categoryIds: 1 },
    { name: "playlists_categoryIds" },
  );

  // Sync any additional Mongoose-declared indexes on PlaylistModel (idempotent).
  await PlaylistModel.ensureIndexes();
}
