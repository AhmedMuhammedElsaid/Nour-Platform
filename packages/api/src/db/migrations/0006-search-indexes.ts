import { getDb } from "../client";

/*
 * Migration 0006: full-text search indexes for the public search page.
 *
 * A MongoDB collection may hold only ONE text index, spanning multiple fields.
 * These are the first text indexes on `playlists` and `tracks`, so creation is
 * safe and idempotent (re-running with the same spec+name is a no-op).
 *
 * Title + description fields are indexed across both embedded locales (ar/en)
 * so a single $text query matches content in either language.
 *
 * Safe to append LAST in the runner — it only adds indexes and touches no
 * documents, so it does not interact with the embedded-locale data shape.
 */
export const name = "0006-search-indexes";

export async function up(): Promise<void> {
  const mongoose = await getDb();
  const db = mongoose.connection.db!;

  await db.collection("playlists").createIndex(
    {
      "ar.title": "text",
      "en.title": "text",
      "ar.description": "text",
      "en.description": "text",
    },
    { name: "playlists_text_search" },
  );

  await db.collection("tracks").createIndex(
    { "ar.title": "text", "en.title": "text" },
    { name: "tracks_text_search" },
  );
}
