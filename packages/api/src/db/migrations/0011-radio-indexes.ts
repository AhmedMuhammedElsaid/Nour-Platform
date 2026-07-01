import { getDb } from "../client";
import { RadioStationModel } from "../models/radio-station.model";

/*
 * Migration 0011: create indexes for the new `radioStations` collection.
 * Additive only — registers the Mongoose-declared indexes (unique `slug`,
 * {isLive,isFeatured,order}, {isLive,order}). Safe to run in isolation on Atlas.
 * Run with `--only 0011-radio-indexes`, never the full chain.
 */
export const name = "0011-radio-indexes";

export async function up(): Promise<void> {
  await getDb();
  await RadioStationModel.ensureIndexes();
}
