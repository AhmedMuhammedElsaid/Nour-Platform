import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/*
 * Mongoose model for the `categories` collection. Mirrors the Zod schema in
 * `schemas/category.ts` (per-locale documents — DATABASE.md §3). Each document
 * is one locale of a taxonomy node; `contentId` ties the AR/EN variants
 * together. Playlists reference a category by its `contentId`. Slug uniqueness
 * is scoped per locale.
 */
const categorySchema = new Schema(
  {
    contentId: { type: Schema.Types.ObjectId, required: true },
    locale: { type: String, enum: ["ar", "en"], required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
    },
    description: { type: String, maxlength: 500 },
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
  },
  { timestamps: true, collection: "categories" },
);

categorySchema.index({ locale: 1, slug: 1 }, { unique: true });
categorySchema.index({ contentId: 1, locale: 1 }, { unique: true });

export type CategoryDoc = InferSchemaType<typeof categorySchema> & {
  _id: mongoose.Types.ObjectId;
};

type CategoryModelType = Model<CategoryDoc>;

export const CategoryModel: CategoryModelType =
  (mongoose.models.Category as CategoryModelType | undefined) ??
  mongoose.model<CategoryDoc>("Category", categorySchema);
