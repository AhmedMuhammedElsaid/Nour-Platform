import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const localeContentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const trackSchema = new Schema(
  {
    ar: { type: localeContentSchema, required: true },
    en: { type: localeContentSchema, required: true },
    mediaId: { type: Schema.Types.ObjectId, ref: "Media", required: true },
    playlistId: { type: Schema.Types.ObjectId, required: true },
    order: { type: Number, required: true, min: 0 },
    durationSecs: { type: Number, min: 0 },
  },
  { timestamps: true, collection: "tracks" },
);

trackSchema.index({ "ar.slug": 1, playlistId: 1 }, { unique: true });
trackSchema.index({ "en.slug": 1, playlistId: 1 }, { unique: true });
trackSchema.index({ playlistId: 1, order: 1 });

export type TrackDoc = InferSchemaType<typeof trackSchema> & {
  _id: mongoose.Types.ObjectId;
};

type TrackModelType = Model<TrackDoc>;

export const TrackModel: TrackModelType =
  (mongoose.models.Track as TrackModelType | undefined) ??
  mongoose.model<TrackDoc>("Track", trackSchema);
