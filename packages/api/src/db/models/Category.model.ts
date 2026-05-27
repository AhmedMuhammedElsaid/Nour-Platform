import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const localeContentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const categorySchema = new Schema(
  {
    ar: { type: localeContentSchema, required: true },
    en: { type: localeContentSchema, required: true },
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
  },
  { timestamps: true, collection: "categories" },
);

categorySchema.index({ "ar.slug": 1 }, { unique: true });
categorySchema.index({ "en.slug": 1 }, { unique: true });

export type CategoryDoc = InferSchemaType<typeof categorySchema> & {
  _id: mongoose.Types.ObjectId;
};

type CategoryModelType = Model<CategoryDoc>;

export const CategoryModel: CategoryModelType =
  (mongoose.models.Category as CategoryModelType | undefined) ??
  mongoose.model<CategoryDoc>("Category", categorySchema);
