import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const quranEditionSchema = new Schema(
  {
    slug: { type: String, required: true },
    language: { type: String, required: true },
    name: { type: String, required: true },
    author: { type: String, required: true },
    type: { type: String, enum: ["translation", "tafsir"], required: true },
    dir: { type: String, enum: ["rtl", "ltr"], required: true },
  },
  { collection: "quranEditions" },
);

quranEditionSchema.index({ slug: 1 }, { unique: true });

export type QuranEditionDoc = InferSchemaType<typeof quranEditionSchema> & {
  _id: mongoose.Types.ObjectId;
};
type QuranEditionModelType = Model<QuranEditionDoc>;

export const QuranEditionModel: QuranEditionModelType =
  (mongoose.models.QuranEdition as QuranEditionModelType | undefined) ??
  mongoose.model<QuranEditionDoc>("QuranEdition", quranEditionSchema);
