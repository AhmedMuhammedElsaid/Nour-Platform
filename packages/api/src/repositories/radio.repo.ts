import type mongoose from "mongoose";

import { getDb } from "../db/client";
import { RadioStationModel, type RadioStationDoc } from "../db/models/radio-station.model";

export type RadioStationLean = RadioStationDoc & { _id: mongoose.Types.ObjectId };

// Public reads only surface enabled stations (`isLive: true`); a dead stream is
// hidden by flipping the flag in the DB — no app release needed.
export async function findAllStations(): Promise<RadioStationLean[]> {
  await getDb();
  return RadioStationModel.find({ isLive: true }).sort({ order: 1 }).lean<RadioStationLean[]>();
}

export async function findFeaturedStations(): Promise<RadioStationLean[]> {
  await getDb();
  return RadioStationModel.find({ isLive: true, isFeatured: true })
    .sort({ order: 1 })
    .lean<RadioStationLean[]>();
}

// Slug is a single globally-unique field (not per-locale like playlists), so the
// lookup takes just the slug. Returns even non-live stations by id/slug so a
// future admin can inspect a disabled one; the service decides visibility.
export async function findStationBySlug(slug: string): Promise<RadioStationLean | null> {
  await getDb();
  return RadioStationModel.findOne({ slug }).lean<RadioStationLean>();
}

export async function findStationById(id: string): Promise<RadioStationLean | null> {
  await getDb();
  return RadioStationModel.findById(id).lean<RadioStationLean>();
}
