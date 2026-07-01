import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const quranReciterSchema = new Schema(
  {
    slug: { type: String, required: true },
    name: { type: String, required: true },
    arabicName: { type: String },
    image: { type: String },
    style: { type: String },
    audioBase: { type: String, required: true },
  },
  { collection: "quranReciters" },
);

quranReciterSchema.index({ slug: 1 }, { unique: true });

export type QuranReciterDoc = InferSchemaType<typeof quranReciterSchema> & {
  _id: mongoose.Types.ObjectId;
};
type QuranReciterModelType = Model<QuranReciterDoc>;

export const QuranReciterModel: QuranReciterModelType =
  (mongoose.models.QuranReciter as QuranReciterModelType | undefined) ??
  mongoose.model<QuranReciterDoc>("QuranReciter", quranReciterSchema);
