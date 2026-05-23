import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/*
 * Mongoose model for the `tracks` collection. Mirrors the Zod schema in
 * `schemas/track.ts` (DATABASE.md Audio MVP). Each track belongs to exactly
 * one Playlist; `order` encodes the display position (0-indexed) within
 * that playlist. The (playlistId, slug) compound index is unique so slugs
 * only need to be unique within a playlist, not globally.
 *
 * `durationSecs` is absent on newly-created tracks and backfilled by the
 * audio-analysis worker after the linked Media transitions to `confirmed`.
 */
const trackSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    description: { type: String, maxlength: 2000 },
    mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true },
    playlistId: {
      type: Schema.Types.ObjectId,
      ref: "Playlist",
      required: true,
      index: true,
    },
    order: { type: Number, required: true, min: 0 },
    durationSecs: { type: Number, min: 0 },
  },
  { timestamps: true, collection: "tracks" },
);

// Slug uniqueness scoped to a playlist, not globally.
trackSchema.index({ playlistId: 1, slug: 1 }, { unique: true });
// Fast ascending-order fetch for the player queue.
trackSchema.index({ playlistId: 1, order: 1 });

export type TrackDoc = InferSchemaType<typeof trackSchema> & {
  _id: mongoose.Types.ObjectId;
};

type TrackModelType = Model<TrackDoc>;

export const TrackModel: TrackModelType =
  (mongoose.models.Track as TrackModelType | undefined) ??
  mongoose.model<TrackDoc>("Track", trackSchema);
