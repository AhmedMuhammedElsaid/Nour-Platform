import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const quranTranslationSchema = new Schema(
  {
    editionSlug: { type: String, required: true },
    numberGlobal: { type: Number, required: true, min: 1, max: 6236 },
    text: { type: String, required: true },
  },
  { collection: "quranTranslations" },
);

quranTranslationSchema.index({ editionSlug: 1, numberGlobal: 1 }, { unique: true });

export type QuranTranslationDoc = InferSchemaType<typeof quranTranslationSchema> & {
  _id: mongoose.Types.ObjectId;
};
type QuranTranslationModelType = Model<QuranTranslationDoc>;

export const QuranTranslationModel: QuranTranslationModelType =
  (mongoose.models.QuranTranslation as QuranTranslationModelType | undefined) ??
  mongoose.model<QuranTranslationDoc>("QuranTranslation", quranTranslationSchema);
