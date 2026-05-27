import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/*
 * Mongoose model for the `tracks` collection. Mirrors the Zod schema in
 * `schemas/track.ts` (per-locale documents — DATABASE.md §3). A track belongs
 * to one logical playlist via `playlistContentId`; `order` encodes its display
 * position (0-indexed) and is the sole source of ordering. `contentId` ties the
 * track's AR/EN variants together; `mediaId` is the shared (locale-neutral)
 * audio object. The (playlistContentId, locale, slug) index is unique so slugs
 * only need to be unique within a playlist + locale.
 *
 * `durationSecs` is absent on newly-created tracks and backfilled by the
 * audio-analysis worker after the linked Media transitions to `confirmed`.
 */
const trackSchema = new Schema(
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
    mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true },
    playlistContentId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    order: { type: Number, required: true, min: 0 },
    durationSecs: { type: Number, min: 0 },
  },
  { timestamps: true, collection: "tracks" },
);

// Slug uniqueness scoped to a playlist + locale.
trackSchema.index({ playlistContentId: 1, locale: 1, slug: 1 }, { unique: true });
// Fast ascending-order fetch for the player queue (per playlist + locale).
trackSchema.index({ playlistContentId: 1, locale: 1, order: 1 });
// One track document per (contentId, locale).
trackSchema.index({ contentId: 1, locale: 1 }, { unique: true });

export type TrackDoc = InferSchemaType<typeof trackSchema> & {
  _id: mongoose.Types.ObjectId;
};

type TrackModelType = Model<TrackDoc>;

export const TrackModel: TrackModelType =
  (mongoose.models.Track as TrackModelType | undefined) ??
  mongoose.model<TrackDoc>("Track", trackSchema);
