import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// Embedded-locale radio station document. Mirrors the azkar/playlist model shape
// (single doc, `ar`/`en` sub-objects, hot-reload guard). Collection: radioStations.

const localeContentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 2000 },
  },
  { _id: false },
);

const radioStationSchema = new Schema(
  {
    slug: { type: String, required: true, trim: true, maxlength: 200 },
    ar: { type: localeContentSchema, required: true },
    en: { type: localeContentSchema, required: true },
    country: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    city: { type: String, maxlength: 100 },
    image: { type: String, maxlength: 500 },
    streamUrl: { type: String, required: true, maxlength: 1000 },
    streamType: { type: String, required: true, enum: ["mp3", "aac", "hls"], default: "mp3" },
    bitrate: { type: Number, min: 1 },
    language: { type: String, required: true, default: "ar", maxlength: 10 },
    category: { type: String, required: true, enum: ["quran", "islamic"], default: "quran" },
    nowPlayingUrl: { type: String, maxlength: 1000 },
    isLive: { type: Boolean, required: true, default: true },
    isFeatured: { type: Boolean, required: true, default: false },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: "radioStations" },
);

radioStationSchema.index({ slug: 1 }, { unique: true });
radioStationSchema.index({ isLive: 1, isFeatured: 1, order: 1 });
radioStationSchema.index({ isLive: 1, order: 1 });

export type RadioStationDoc = InferSchemaType<typeof radioStationSchema> & {
  _id: mongoose.Types.ObjectId;
};

type RadioStationModelType = Model<RadioStationDoc>;

export const RadioStationModel: RadioStationModelType =
  (mongoose.models.RadioStation as RadioStationModelType | undefined) ??
  mongoose.model<RadioStationDoc>("RadioStation", radioStationSchema);
