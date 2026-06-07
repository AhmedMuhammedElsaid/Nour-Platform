import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const quranTafsirSchema = new Schema(
  {
    editionSlug: { type: String, required: true },
    numberGlobal: { type: Number, required: true, min: 1, max: 6236 },
    text: { type: String, required: true },
  },
  { collection: "quranTafsir" },
);

quranTafsirSchema.index({ editionSlug: 1, numberGlobal: 1 }, { unique: true });

export type QuranTafsirDoc = InferSchemaType<typeof quranTafsirSchema> & {
  _id: mongoose.Types.ObjectId;
};
type QuranTafsirModelType = Model<QuranTafsirDoc>;

export const QuranTafsirModel: QuranTafsirModelType =
  (mongoose.models.QuranTafsir as QuranTafsirModelType | undefined) ??
  mongoose.model<QuranTafsirDoc>("QuranTafsir", quranTafsirSchema);
