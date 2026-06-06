import { getDb } from "../client";
import { AzkarModel } from "../models/azkar.model";

/*
 * Migration 0008: create indexes for the new `azkar` collection.
 * Additive only — registers the Mongoose-declared indexes (unique ar/en slug,
 * {status,order}, {order}). Safe to run in isolation on Atlas.
 */
export const name = "0008-azkar-indexes";

export async function up(): Promise<void> {
  await getDb();
  await AzkarModel.ensureIndexes();
}
