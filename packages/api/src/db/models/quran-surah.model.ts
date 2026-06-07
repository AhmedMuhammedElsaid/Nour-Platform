import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const quranSurahSchema = new Schema(
  {
    number: { type: Number, required: true, min: 1, max: 114 },
    name: {
      ar: { type: String, required: true },
      en: { type: String, required: true },
    },
    meaning: { type: String, required: true },
    revelationPlace: { type: String, enum: ["meccan", "medinan"], required: true },
    ayahCount: { type: Number, required: true, min: 1 },
    pageStart: { type: Number, required: true, min: 1, max: 604 },
    pageEnd: { type: Number, required: true, min: 1, max: 604 },
    bismillahPre: { type: Boolean, required: true },
  },
  { collection: "quranSurahs" },
);

quranSurahSchema.index({ number: 1 }, { unique: true });

export type QuranSurahDoc = InferSchemaType<typeof quranSurahSchema> & {
  _id: mongoose.Types.ObjectId;
};
type QuranSurahModelType = Model<QuranSurahDoc>;

export const QuranSurahModel: QuranSurahModelType =
  (mongoose.models.QuranSurah as QuranSurahModelType | undefined) ??
  mongoose.model<QuranSurahDoc>("QuranSurah", quranSurahSchema);
