import { PlaylistModel } from "../models/playlist.model";
import { TrackModel } from "../models/track.model";
import { MediaModel } from "../models/media.model";

/*
 * Migration 0001: ensure all MVP collection indexes exist.
 *
 * Calls `ensureIndexes()` on each model, which maps to MongoDB `createIndex`
 * under the hood. MongoDB's `createIndex` is idempotent — if an index with the
 * same key pattern and options already exists, it is a no-op, so this migration
 * is safe to run multiple times.
 *
 * `getDb()` is NOT called here. The runner (`scripts/migrate.ts`) is
 * responsible for establishing the connection before invoking `up()`.
 */
export const name = "0001-indexes";

export async function up(): Promise<void> {
  await PlaylistModel.ensureIndexes();
  await TrackModel.ensureIndexes();
  await MediaModel.ensureIndexes();
}
