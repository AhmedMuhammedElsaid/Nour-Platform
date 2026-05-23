import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/*
 * Mongoose model for the `playlists` collection. Mirrors the Zod schema in
 * `schemas/playlist.ts` (DATABASE.md Audio MVP). `trackIds` holds an ordered
 * list of ObjectId refs; order is authoritative here — the reorder service
 * replaces the whole array in one atomic write.
 *
 * Compound index on `(status, slug)` supports the public published-playlist
 * lookup in O(log n); unique `slug` index enforces uniqueness at the DB level.
 */
const playlistSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    description: { type: String, maxlength: 2000 },
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
    status: {
      type: String,
      enum: ["draft", "published"],
      required: true,
      default: "draft",
    },
    trackIds: { type: [Schema.Types.ObjectId], ref: "Track", default: [] },
  },
  { timestamps: true, collection: "playlists" },
);

playlistSchema.index({ status: 1, slug: 1 });

export type PlaylistDoc = InferSchemaType<typeof playlistSchema> & {
  _id: mongoose.Types.ObjectId;
};

type PlaylistModelType = Model<PlaylistDoc>;

export const PlaylistModel: PlaylistModelType =
  (mongoose.models.Playlist as PlaylistModelType | undefined) ??
  mongoose.model<PlaylistDoc>("Playlist", playlistSchema);
