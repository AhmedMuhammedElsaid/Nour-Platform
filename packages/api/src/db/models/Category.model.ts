import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/*
 * Mongoose model for the `categories` collection. Mirrors the Zod schema in
 * `schemas/category.ts` (P2-A Scholars + Categories phase). Categories are a
 * top-level taxonomy used to group playlists and future resources.
 *
 * Unique index on `slug` enforces URL-path uniqueness at the DB level.
 */
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 200,
      index: true,
    },
    description: { type: String, maxlength: 500 },
    coverMediaId: { type: Schema.Types.ObjectId, ref: "Media" },
  },
  { timestamps: true, collection: "categories" },
);

export type CategoryDoc = InferSchemaType<typeof categorySchema> & {
  _id: mongoose.Types.ObjectId;
};

type CategoryModelType = Model<CategoryDoc>;

export const CategoryModel: CategoryModelType =
  (mongoose.models.Category as CategoryModelType | undefined) ??
  mongoose.model<CategoryDoc>("Category", categorySchema);
