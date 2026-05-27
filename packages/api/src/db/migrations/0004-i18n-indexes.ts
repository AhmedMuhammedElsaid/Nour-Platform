import type { Collection } from "mongodb";

import { getDb } from "../client";
import { PlaylistModel } from "../models/playlist.model";
import { CategoryModel } from "../models/Category.model";
import { TrackModel } from "../models/track.model";

/*
 * Migration 0004: replace the single-locale unique indexes with the per-locale
 * compound indexes declared on the updated models.
 *
 * MUST run AFTER 0003 — the new {locale, slug} unique indexes require every
 * document to already have a non-null `locale`.
 *
 * Two steps:
 *  1. Drop the obsolete global-unique slug indexes (and the old playlistId
 *     indexes on tracks). Each drop is wrapped so a missing index is a no-op,
 *     keeping the migration idempotent.
 *  2. `ensureIndexes()` on each model to build the new compound indexes
 *     declared in the *.model.ts files (idempotent by nature).
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

  // 2. Build the new per-locale compound indexes declared on the models.
  await PlaylistModel.ensureIndexes();
  await CategoryModel.ensureIndexes();
  await TrackModel.ensureIndexes();
}
