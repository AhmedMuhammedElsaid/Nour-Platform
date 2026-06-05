import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const localePairSchema = new Schema(
  { ar: { type: String, maxlength: 2000 }, en: { type: String, maxlength: 2000 } },
  { _id: false },
);

const dhikrItemSchema = new Schema(
  {
    ar: { type: String, required: true, trim: true, maxlength: 4000 },
    en: { type: String, maxlength: 4000 },
    transliteration: { type: String, maxlength: 4000 },
    repeat: { type: Number, required: true, min: 1, max: 1000 },
    virtue: { type: localePairSchema },
    source: { type: localePairSchema },
    audioMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
  },
  { _id: false },
);

const localeTitleSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, maxlength: 200 },
  },
  { _id: false },
);

const azkarSchema = new Schema(
  {
    kind: { type: String, required: true, enum: ["morning", "evening", "other"] },
    status: { type: String, required: true, enum: ["draft", "published"], default: "draft" },
    order: { type: Number, required: true, default: 0 },
    ar: { type: localeTitleSchema, required: true },
    en: { type: localeTitleSchema, required: true },
    items: { type: [dhikrItemSchema], default: [] },
  },
  { timestamps: true, collection: "azkar" },
);

azkarSchema.index({ "ar.slug": 1 }, { unique: true });
azkarSchema.index({ "en.slug": 1 }, { unique: true });
azkarSchema.index({ status: 1, order: 1 });
azkarSchema.index({ order: 1 });

export type AzkarDoc = InferSchemaType<typeof azkarSchema> & {
  _id: mongoose.Types.ObjectId;
};

type AzkarModelType = Model<AzkarDoc>;

export const AzkarModel: AzkarModelType =
  (mongoose.models.Azkar as AzkarModelType | undefined) ??
  mongoose.model<AzkarDoc>("Azkar", azkarSchema);
