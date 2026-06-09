import mongoose from "mongoose";

import { getDb } from "../client";

/*
 * Migration 0003: backfill the i18n fields introduced in Wave i18n-A.
 *
 * Before this wave content was single-locale with no `locale`/`contentId`.
 * This migration treats every existing document as the Arabic (default-locale)
 * version of a fresh logical program:
 *
 *   playlists   → set locale='ar', mint a contentId, $unset the dropped trackIds
 *   categories  → set locale='ar', mint a contentId
 *   tracks      → set locale='ar', mint a contentId, set playlistContentId from
 *                 the parent playlist's new contentId (resolved via old playlistId),
 *                 $unset the old playlistId
 *
 * MUST run BEFORE 0004 (which builds the {locale,slug} unique indexes) — those
 * indexes would fail on documents whose `locale` is still null.
 *
 * Idempotent: documents that already have a `locale` are skipped, so re-running
 * is a no-op. Run order is guaranteed by the array in scripts/migrate.ts.
 *
 * SAFETY GUARD: after the embedded-locale refactor (0005) documents carry
 * `ar`/`en` sub-objects and NO top-level `locale` — they would match this
 * migration's `{ locale: { $exists: false } }` filter and get a bogus
 * `locale:'ar'` + `contentId` written back, corrupting the embedded shape.
 * If any embedded document is detected the whole migration no-ops, so the
 * full `pnpm migrate` chain is safe to run against an already-embedded DB.
 */
export const name = "0003-i18n-backfill";

type EmbeddedCheckDb = {
  collection(name: string): {
    findOne(
      filter: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<unknown>;
  };
};

export async function dbHasEmbeddedLocaleDocs(
  db: EmbeddedCheckDb,
): Promise<boolean> {
  for (const name of ["playlists", "categories", "tracks"]) {
    const doc = await db
      .collection(name)
      .findOne({ ar: { $exists: true } }, { projection: { _id: 1 } });
    if (doc) return true;
  }
  return false;
}

export async function up(): Promise<void> {
  const conn = await getDb();
  const db = conn.connection.db!;

  if (await dbHasEmbeddedLocaleDocs(db)) {
    console.warn(
      "[0003] embedded-locale documents detected — this transitional migration " +
        "no longer applies and would corrupt them; skipping.",
    );
    return;
  }

  const playlists = db.collection("playlists");
  const categories = db.collection("categories");
  const tracks = db.collection("tracks");

  // 1. Playlists — assign locale + contentId, drop the trackIds mirror.
  const playlistCursor = playlists.find({ locale: { $exists: false } });
  for await (const doc of playlistCursor) {
    await playlists.updateOne(
      { _id: doc._id },
      {
        $set: { locale: "ar", contentId: new mongoose.Types.ObjectId() },
        $unset: { trackIds: "" },
      },
    );
  }

  // 2. Categories — assign locale + contentId.
  const categoryCursor = categories.find({ locale: { $exists: false } });
  for await (const doc of categoryCursor) {
    await categories.updateOne(
      { _id: doc._id },
      { $set: { locale: "ar", contentId: new mongoose.Types.ObjectId() } },
    );
  }

  // 3. Build _id → contentId map across ALL playlists (post-step-1 every
  //    playlist has a contentId), so tracks can be re-linked by contentId.
  const playlistContentByOldId = new Map<string, mongoose.Types.ObjectId>();
  const allPlaylists = playlists.find(
    {},
    { projection: { _id: 1, contentId: 1 } },
  );
  for await (const p of allPlaylists) {
    if (p.contentId) {
      playlistContentByOldId.set(String(p._id), p.contentId);
    }
  }

  // 4. Tracks — assign locale + contentId, re-link to the playlist's contentId,
  //    drop the old playlistId.
  const trackCursor = tracks.find({ locale: { $exists: false } });
  for await (const doc of trackCursor) {
    const playlistContentId = doc.playlistId
      ? playlistContentByOldId.get(String(doc.playlistId))
      : undefined;

    if (!playlistContentId) {
      // Orphan track (parent playlist missing). Leave it for manual cleanup
      // rather than guessing — 0004's unique index tolerates it only if it
      // still gets a locale, so skip and log.
      console.warn(
        `[0003] track ${String(doc._id)} has no resolvable parent playlist; skipping re-link`,
      );
      continue;
    }

    await tracks.updateOne(
      { _id: doc._id },
      {
        $set: {
          locale: "ar",
          contentId: new mongoose.Types.ObjectId(),
          playlistContentId,
        },
        $unset: { playlistId: "" },
      },
    );
  }
}
