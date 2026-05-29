import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { CategoryModel, type CategoryDoc } from "../db/models/Category.model";
import type { Locale } from "../schemas/locale";
import type { CategoryCreateInput, CategoryUpdateInput } from "../schemas/category";
import { flattenLocaleUpdate } from "../utils/mongo-update";

export type CategoryLean = CategoryDoc & { _id: mongoose.Types.ObjectId };

export async function findAll(): Promise<CategoryLean[]> {
  await getDb();
  return CategoryModel.find({}).sort({ "ar.name": 1 }).lean<CategoryLean[]>();
}

export async function findBySlug(
  locale: Locale,
  slug: string,
): Promise<CategoryLean | null> {
  await getDb();
  const field = locale === "ar" ? "ar.slug" : "en.slug";
  return CategoryModel.findOne({ [field]: slug }).lean<CategoryLean>();
}

export async function findById(id: string): Promise<CategoryLean | null> {
  await getDb();
  return CategoryModel.findById(id).lean<CategoryLean>();
}

export async function create(
  data: Omit<CategoryCreateInput, "ar" | "en"> & {
    ar: { name: string; slug: string; description?: string };
    en: { name: string; slug: string; description?: string };
  },
): Promise<CategoryLean> {
  await getDb();
  const doc = await CategoryModel.create(data);
  const lean = await CategoryModel.findById(doc._id).lean<CategoryLean>();
  return lean!;
}

export async function updateById(
  id: string,
  patch: CategoryUpdateInput,
): Promise<CategoryLean | null> {
  await getDb();
  return CategoryModel.findByIdAndUpdate(
    id,
    { $set: flattenLocaleUpdate(patch) },
    { new: true },
  ).lean<CategoryLean>();
}

export async function deleteById(id: string): Promise<boolean> {
  await getDb();
  const result = await CategoryModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}
