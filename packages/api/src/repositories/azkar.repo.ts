import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { AzkarModel, type AzkarDoc } from "../db/models/azkar.model";
import type { Locale } from "../schemas/locale";
import type { AzkarCreateInput, AzkarUpdateInput } from "../schemas/azkar";
import { flattenLocaleUpdate } from "../utils/mongo-update";

export type AzkarLean = AzkarDoc & { _id: mongoose.Types.ObjectId };

export async function findPublishedAzkar(): Promise<AzkarLean[]> {
  await getDb();
  return AzkarModel.find({ status: "published" })
    .sort({ order: 1 })
    .lean<AzkarLean[]>();
}

export async function findAllAzkar(): Promise<AzkarLean[]> {
  await getDb();
  return AzkarModel.find({}).sort({ order: 1 }).lean<AzkarLean[]>();
}

export async function findAzkarBySlug(
  locale: Locale,
  slug: string,
): Promise<AzkarLean | null> {
  await getDb();
  const field = locale === "ar" ? "ar.slug" : "en.slug";
  return AzkarModel.findOne({ [field]: slug, status: "published" }).lean<AzkarLean>();
}

export async function findAzkarById(id: string): Promise<AzkarLean | null> {
  await getDb();
  return AzkarModel.findById(id).lean<AzkarLean>();
}

export async function createAzkar(
  data: Omit<AzkarCreateInput, "ar" | "en" | "status" | "order"> & {
    ar: { title: string; slug: string };
    en: { title: string; slug: string };
    status: AzkarCreateInput["status"];
    order: number;
  },
): Promise<AzkarLean> {
  await getDb();
  const doc = await AzkarModel.create(data);
  const lean = await AzkarModel.findById(doc._id).lean<AzkarLean>();
  return lean!;
}

export async function updateAzkarById(
  id: string,
  patch: AzkarUpdateInput,
): Promise<AzkarLean | null> {
  await getDb();
  // flattenLocaleUpdate only dot-expands `ar`/`en` locale keys (plain objects).
  // It passes all other keys — including the `items` array — through unchanged
  // (the isPlainObject guard explicitly rejects arrays). No special handling
  // needed: items is safe to pass directly through the flattener.
  return AzkarModel.findByIdAndUpdate(
    id,
    { $set: flattenLocaleUpdate(patch as Record<string, unknown>) },
    { new: true },
  ).lean<AzkarLean>();
}

export async function deleteAzkarById(id: string): Promise<boolean> {
  await getDb();
  const result = await AzkarModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}

export async function updateAzkarOrder(orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  await getDb();
  await AzkarModel.bulkWrite(
    orderedIds.map((id, index) => ({
      updateOne: { filter: { _id: id }, update: { $set: { order: index } } },
    })),
  );
}
