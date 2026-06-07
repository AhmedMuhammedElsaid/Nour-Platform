import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const quranWordSchema = new Schema(
  {
    position: { type: Number, required: true, min: 1 },
    arabic: { type: String, required: true },
    transliteration: { type: String },
    glossEn: { type: String },
  },
  { _id: false },
);

const quranAyahSchema = new Schema(
  {
    surah: { type: Number, required: true, min: 1, max: 114 },
    ayahInSurah: { type: Number, required: true, min: 1 },
    numberGlobal: { type: Number, required: true, min: 1, max: 6236 },
    juz: { type: Number, required: true, min: 1, max: 30 },
    hizb: { type: Number, required: true, min: 1 },
    page: { type: Number, required: true, min: 1, max: 604 },
    sajda: { type: Boolean, required: true, default: false },
    textUthmani: { type: String, required: true },
    words: { type: [quranWordSchema], default: [] },
  },
  { collection: "quranAyahs" },
);

quranAyahSchema.index({ surah: 1, ayahInSurah: 1 }, { unique: true });
quranAyahSchema.index({ numberGlobal: 1 }, { unique: true });
quranAyahSchema.index({ juz: 1 });
quranAyahSchema.index({ page: 1 });

export type QuranAyahDoc = InferSchemaType<typeof quranAyahSchema> & {
  _id: mongoose.Types.ObjectId;
};
type QuranAyahModelType = Model<QuranAyahDoc>;

export const QuranAyahModel: QuranAyahModelType =
  (mongoose.models.QuranAyah as QuranAyahModelType | undefined) ??
  mongoose.model<QuranAyahDoc>("QuranAyah", quranAyahSchema);
