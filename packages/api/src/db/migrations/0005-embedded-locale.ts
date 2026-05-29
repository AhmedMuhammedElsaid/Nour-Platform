import { getDb } from "../client";
import { PlaylistModel } from "../models/playlist.model";
import { TrackModel } from "../models/track.model";
import { CategoryModel } from "../models/Category.model";
import { slugify } from "../../utils/slug";

/*
 * Fill a slug on any already-embedded doc that lacks one. An earlier revision
 * of this migration embedded `ar`/`en` without deriving a slug; those docs have
 * no `contentId`, so the merge loops below never visit them and they can never
 * self-heal — leaving `{ar,en}.slug` undefined, which surfaces as
 * `/playlists/undefined` links in the web app. We mint a slug from the
 * title/name (Unicode-aware, slugSchema-compatible) wherever one is absent.
 */
async function backfillSlugs(
  coll: import("mongodb").Collection,
  titleField: "title" | "name",
): Promise<void> {
  const broken = await coll
    .find({
      $or: [
        { "ar.slug": { $exists: false } },
        { "ar.slug": { $in: [null, ""] } },
        { "en.slug": { $exists: false } },
        { "en.slug": { $in: [null, ""] } },
      ],
    })
    .toArray();

  for (const d of broken) {
    const ar = d["ar"] as Record<string, unknown> | undefined;
    const en = d["en"] as Record<string, unknown> | undefined;
    const setOps: Record<string, string> = {};
    if (ar && !ar["slug"]) {
      setOps["ar.slug"] = slugify(String(ar[titleField] ?? ""), String(d._id));
    }
    if (en && !en["slug"]) {
      setOps["en.slug"] = slugify(String(en[titleField] ?? ""), String(d._id));
    }
    if (Object.keys(setOps).length > 0) {
      await coll.updateOne({ _id: d._id }, { $set: setOps });
    }
  }
}

/*
 * Migration 0005: collapse per-locale documents into single embedded-locale docs.
 *
 * Each collection previously stored separate AR and EN documents linked by `contentId`.
 * After this migration each entity is a single document with `ar: {}` and `en: {}` keys.
 *
 * Run order: must execute BEFORE 0001/0002 (ensureIndexes) so the new compound
 * slug indexes build on already-migrated data.
 *
 * Idempotent: documents that already have an `ar` sub-object are skipped.
 */
export const name = "0005-embedded-locale";

export async function up(): Promise<void> {
  const conn = await getDb();
  const db = conn.connection.db!;

  const cats = db.collection("categories");
  const playlists = db.collection("playlists");
  const tracks = db.collection("tracks");

  // Drop all non-_id indexes first so old unique constraints
  // don't block the document mutations below.
  await cats.dropIndexes();
  await playlists.dropIndexes();
  await tracks.dropIndexes();

  // ---- 1. Merge Category documents ----
  // Build contentId → surviving _id map for playlist re-linking.
  const categoryIdMap = new Map<string, unknown>();

  const catContentIds: unknown[] = await cats.distinct("contentId");
  for (const contentId of catContentIds) {
    const docs = await cats.find({ contentId }).toArray();
    const ar = docs.find((d) => d["locale"] === "ar");
    const en = docs.find((d) => d["locale"] === "en");

    // Skip already-migrated documents (no `locale` field means already embedded).
    if (!ar && !en) continue;
    const survivor = ar ?? en!;
    const victim = ar && en ? en : null;

    // Idempotency: if survivor already has the embedded `ar` sub-object,
    // it's been merged before — just strip stale per-locale fields and move on.
    if (survivor["ar"] && typeof survivor["ar"] === "object") {
      await cats.updateOne(
        { _id: survivor._id },
        { $unset: { contentId: "", locale: "", name: "", slug: "", description: "" } },
      );
      if (victim) await cats.deleteOne({ _id: victim._id });
      categoryIdMap.set(String(contentId), survivor._id);
      continue;
    }

    const arName = ar?.["name"] ?? en?.["name"];
    const enName = en?.["name"] ?? ar?.["name"];
    const arSlug = ar?.["slug"] ?? en?.["slug"];
    const enSlug = en?.["slug"] ?? ar?.["slug"];

    await cats.updateOne(
      { _id: survivor._id },
      {
        $set: {
          ar: {
            name: arName,
            slug: arSlug,
            ...(ar?.["description"] ? { description: ar["description"] } : {}),
          },
          en: {
            name: enName,
            slug: enSlug,
            ...(en?.["description"] ? { description: en["description"] } : {}),
          },
        },
        $unset: { contentId: "", locale: "", name: "", slug: "", description: "" },
      },
    );

    if (victim) await cats.deleteOne({ _id: victim._id });
    categoryIdMap.set(String(contentId), survivor._id);
  }

  // ---- 2. Merge Playlist documents ----
  const playlistIdMap = new Map<string, unknown>();

  const playlistContentIds: unknown[] = await playlists.distinct("contentId");
  for (const contentId of playlistContentIds) {
    const docs = await playlists.find({ contentId }).toArray();
    const ar = docs.find((d) => d["locale"] === "ar");
    const en = docs.find((d) => d["locale"] === "en");

    if (!ar && !en) continue;
    const survivor = ar ?? en!;
    const victim = ar && en ? en : null;

    // Remap categoryIds: old values were category contentIds → new values are category _ids.
    const oldCategoryIds: unknown[] = survivor["categoryIds"] ?? [];
    const newCategoryIds = oldCategoryIds.map(
      (cid) => categoryIdMap.get(String(cid)) ?? cid,
    );

    if (survivor["ar"] && typeof survivor["ar"] === "object") {
      await playlists.updateOne(
        { _id: survivor._id },
        {
          $set: { categoryIds: newCategoryIds },
          $unset: { contentId: "", locale: "", title: "", slug: "", description: "" },
        },
      );
      if (victim) await playlists.deleteOne({ _id: victim._id });
      playlistIdMap.set(String(contentId), survivor._id);
      continue;
    }

    const arTitle = ar?.["title"] ?? en?.["title"];
    const enTitle = en?.["title"] ?? ar?.["title"];
    const arSlug = ar?.["slug"] ?? en?.["slug"];
    const enSlug = en?.["slug"] ?? ar?.["slug"];

    await playlists.updateOne(
      { _id: survivor._id },
      {
        $set: {
          ar: {
            title: arTitle,
            slug: arSlug,
            ...(ar?.["description"] ? { description: ar["description"] } : {}),
          },
          en: {
            title: enTitle,
            slug: enSlug,
            ...(en?.["description"] ? { description: en["description"] } : {}),
          },
          categoryIds: newCategoryIds,
        },
        $unset: { contentId: "", locale: "", title: "", slug: "", description: "" },
      },
    );

    if (victim) await playlists.deleteOne({ _id: victim._id });
    playlistIdMap.set(String(contentId), survivor._id);
  }

  // ---- 3. Merge Track documents ----
  const trackContentIds: unknown[] = await tracks.distinct("contentId");
  for (const contentId of trackContentIds) {
    const docs = await tracks.find({ contentId }).toArray();
    const ar = docs.find((d) => d["locale"] === "ar");
    const en = docs.find((d) => d["locale"] === "en");

    if (!ar && !en) continue;
    const survivor = ar ?? en!;
    const victim = ar && en ? en : null;

    // Remap playlistContentId → playlistId (the surviving playlist's _id).
    const oldPlaylistContentId = survivor["playlistContentId"];
    const newPlaylistId =
      playlistIdMap.get(String(oldPlaylistContentId)) ?? oldPlaylistContentId;

    if (survivor["ar"] && typeof survivor["ar"] === "object") {
      await tracks.updateOne(
        { _id: survivor._id },
        {
          $set: { playlistId: newPlaylistId },
          $unset: {
            contentId: "",
            locale: "",
            title: "",
            slug: "",
            description: "",
            playlistContentId: "",
          },
        },
      );
      if (victim) await tracks.deleteOne({ _id: victim._id });
      continue;
    }

    const arTitle = ar?.["title"] ?? en?.["title"];
    const enTitle = en?.["title"] ?? ar?.["title"];
    const arSlug = ar?.["slug"] ?? en?.["slug"];
    const enSlug = en?.["slug"] ?? ar?.["slug"];

    await tracks.updateOne(
      { _id: survivor._id },
      {
        $set: {
          ar: {
            title: arTitle,
            slug: arSlug,
            ...(ar?.["description"] ? { description: ar["description"] } : {}),
          },
          en: {
            title: enTitle,
            slug: enSlug,
            ...(en?.["description"] ? { description: en["description"] } : {}),
          },
          playlistId: newPlaylistId,
        },
        $unset: {
          contentId: "",
          locale: "",
          title: "",
          slug: "",
          description: "",
          playlistContentId: "",
        },
      },
    );

    if (victim) await tracks.deleteOne({ _id: victim._id });
  }

  // ---- 3.5 Backfill any docs still missing a slug ----
  // Runs BEFORE ensureIndexes so the unique slug index builds on complete data.
  // Idempotent: only touches docs whose ar/en slug is absent or empty.
  await backfillSlugs(cats, "name");
  await backfillSlugs(playlists, "title");
  await backfillSlugs(tracks, "title");

  // ---- 4. Rebuild indexes on the new schema ----
  await CategoryModel.ensureIndexes();
  await PlaylistModel.ensureIndexes();
  await TrackModel.ensureIndexes();
}
