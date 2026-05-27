import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/*
 * Mongoose model for the `playlists` collection. Mirrors the Zod schema in
 * `schemas/playlist.ts` (DATABASE.md §3 — per-locale documents). Each document
 * is one locale of a logical program; `contentId` ties the AR/EN variants
 * together and `categoryIds` reference category `contentId`s (locale-agnostic).
 *
 * Track ordering is owned by the Track document (`order`); playlists no longer
 * mirror it in a `trackIds` array. Slug uniqueness is scoped per locale.
 */
const playlistSchema = new Schema(
  {
    contentId: { type: Schema.Types.ObjectId, required: true },
    locale: { type: String, enum: ["ar", "en"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    description: { type: String, maxlength: 2000 },
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
    status: {
      type: String,
      enum: ["draft", "published"],
      required: true,
      default: "draft",
    },
    categoryIds: [{ type: Schema.Types.ObjectId, default: [] }],
  },
  { timestamps: true, collection: "playlists" },
);

// Slug unique per locale; one document per (contentId, locale).
playlistSchema.index({ locale: 1, slug: 1 }, { unique: true });
playlistSchema.index({ contentId: 1, locale: 1 }, { unique: true });
// Public home query: published playlists for a locale, newest first.
playlistSchema.index({ status: 1, locale: 1, updatedAt: -1 });

export type PlaylistDoc = InferSchemaType<typeof playlistSchema> & {
  _id: mongoose.Types.ObjectId;
};

type PlaylistModelType = Model<PlaylistDoc>;

export const PlaylistModel: PlaylistModelType =
  (mongoose.models.Playlist as PlaylistModelType | undefined) ??
  mongoose.model<PlaylistDoc>("Playlist", playlistSchema);
