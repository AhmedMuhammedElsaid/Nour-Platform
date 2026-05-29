import type { Collection } from "mongodb";

import { getDb } from "../client";

/*
 * Migration 0004: drop the obsolete single-locale unique indexes.
 *
 * MUST run AFTER 0003 (locale backfill) and BEFORE 0005 (embedded-locale merge).
 * Each drop is wrapped so a missing index is a no-op — idempotent.
 *
 * ensureIndexes() is NOT called here: the Mongoose models already declare the
 * post-0005 embedded-locale indexes; calling ensureIndexes() before 0005
 * converts the documents causes E11000 (ar.slug: null). 0005 handles it.
 */
export const name = "0004-i18n-indexes";

async function dropIndexIfExists(
  collection: Collection,
  indexName: string,
): Promise<void> {
  try {
    await collection.dropIndex(indexName);
  } catch {
    // Index doesn't exist (already dropped or never created) — idempotent no-op.
  }
}

export async function up(): Promise<void> {
  const conn = await getDb();
  const db = conn.connection.db!;

  const playlists = db.collection("playlists");
  const categories = db.collection("categories");
  const tracks = db.collection("tracks");

  // 1. Drop obsolete indexes.
  await dropIndexIfExists(playlists, "slug_1");
  await dropIndexIfExists(playlists, "status_1_slug_1");

  await dropIndexIfExists(categories, "slug_1");
  await dropIndexIfExists(categories, "categories_slug_unique");

  await dropIndexIfExists(tracks, "playlistId_1_slug_1");
  await dropIndexIfExists(tracks, "playlistId_1_order_1");
  await dropIndexIfExists(tracks, "playlistId_1");

  // ensureIndexes() is intentionally NOT called here. The Mongoose models
  // already declare the post-0005 embedded-locale indexes (ar.slug, en.slug),
  // so calling ensureIndexes() before 0005 converts the documents would try
  // to build those indexes on docs that still have a flat `slug` field →
  // E11000 null duplicate. 0005 calls dropIndexes() + ensureIndexes() itself.
}
