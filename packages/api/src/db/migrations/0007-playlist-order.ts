import { getDb } from "../client";
import { PlaylistModel } from "../models/playlist.model";

/*
 * Migration 0007: backfill `order` on all existing playlist documents.
 *
 * When Phase 2 (playlist ordering) ships, every existing playlist must have a
 * stable numeric `order` value so the homepage grid sorts deterministically
 * instead of falling back to Mongo's natural order.
 *
 * Strategy: assign `order = createdAt rank` (oldest playlist gets order=0).
 * New playlists created after this migration are assigned
 * `order = countDocuments()` at creation time (append-to-end default).
 *
 * Also calls `PlaylistModel.ensureIndexes()` to register the two new indexes
 * declared in the updated schema (the unique sparse index on `order`, if any,
 * and the compound query index). This is idempotent — Mongoose skips indexes
 * that already exist.
 */
export const name = "0007-playlist-order";

export async function up(): Promise<void> {
  await getDb();

  // Fetch all playlists sorted by creation date (earliest = position 0).
  const playlists = await PlaylistModel.find({})
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();

  if (playlists.length === 0) {
    // Nothing to backfill; still call ensureIndexes to register new schema indexes.
    await PlaylistModel.ensureIndexes();
    return;
  }

  // Build a bulk-write op that stamps each playlist with its rank.
  const ops = playlists.map((doc, index) => ({
    updateOne: { filter: { _id: doc._id }, update: { $set: { order: index } } },
  }));
  await PlaylistModel.bulkWrite(ops);

  // Register any new Mongoose-declared indexes introduced by the updated schema.
  await PlaylistModel.ensureIndexes();
}
